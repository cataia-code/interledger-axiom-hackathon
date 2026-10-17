import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config } from '../config/index.js';
import { HttpError } from '../middlewares/errorHandler.js';

// Proveedor Open Payments (red de pruebas de Interledger). Flujo de payments/INTEGRACION.md.
// La app firma con su propia llave; compradores y vendedores solo aportan su wallet address.
// `clientFactory` es reemplazable para probar sin red.

const QUOTE_FALLBACK_MS = 5 * 60_000;
const INCOMING_TTL_MS = 30 * 60_000;

let clientFactory = defaultClientFactory;
export const setClientFactory = (fn) => {
  clientFactory = fn ?? defaultClientFactory;
};
export const pollOptions = { attempts: 15, intervalMs: 2000 };

function privateKeyMaterial() {
  if (config.opPrivateKey) {
    const raw = config.opPrivateKey.trim().replaceAll('\\n', '\n');
    return raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  }
  if (config.opPrivateKeyPath) {
    const raw = readFileSync(config.opPrivateKeyPath, 'utf8').trim();
    return raw.includes('BEGIN') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  }
  throw new HttpError(503, 'Open Payments is not configured', 'PAYMENT_PROVIDER_UNAVAILABLE');
}

async function defaultClientFactory() {
  if (!config.opClientWalletAddress || !config.opKeyId) {
    throw new HttpError(503, 'Open Payments is not configured', 'PAYMENT_PROVIDER_UNAVAILABLE');
  }
  const { createAuthenticatedClient } = await import('@interledger/open-payments');
  return createAuthenticatedClient({
    walletAddressUrl: config.opClientWalletAddress,
    privateKey: privateKeyMaterial(),
    keyId: config.opKeyId,
    requestTimeoutMs: 20_000,
  });
}

const base = (url) => url.replace(/\/+$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tokenOf(grant, label) {
  const value = grant?.access_token?.value;
  if (!value) throw new HttpError(502, `${label} did not return an access token`, 'PAYMENT_PROVIDER_ERROR');
  return value;
}

function isNetworkFailure(err) {
  const text = `${err?.message ?? ''} ${err?.description ?? ''} ${err?.cause?.message ?? ''}`.toLowerCase();
  return ['fetch failed', 'network', 'timed out', 'timeout', 'econnreset', 'socket'].some((t) => text.includes(t));
}

async function retryNetwork(action, attempts = 3) {
  for (let i = 1; ; i += 1) {
    try {
      return await action();
    } catch (err) {
      if (i >= attempts || !isNetworkFailure(err)) throw err;
      await sleep(pollOptions.intervalMs ? 500 * i : 0);
    }
  }
}

// Los errores del SDK o de la red se muestran como un fallo del proveedor, sin filtrar detalles internos.
function wrap(err) {
  if (err instanceof HttpError) return err;
  return new HttpError(502, 'The payment provider rejected the request', 'PAYMENT_PROVIDER_ERROR');
}

export function interactionHash(nonce, serverNonce, interactRef, authServer) {
  return createHash('sha256').update(`${nonce}\n${serverNonce}\n${interactRef}\n${authServer}`).digest('base64');
}

const unpadded = (v) => String(v).replace(/=+$/, '');
export function hashesMatch(expected, received) {
  const a = Buffer.from(unpadded(expected));
  const b = Buffer.from(unpadded(received));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const openpayments = {
  name: 'openpayments',

  // GET a la wallet address: confirma que existe y entrega moneda y escala.
  async resolveWallet(url) {
    try {
      const client = await clientFactory();
      const w = await retryNetwork(() => client.walletAddress.get({ url }));
      return { id: w.id, assetCode: w.assetCode, assetScale: w.assetScale, authServer: w.authServer, resourceServer: w.resourceServer };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(422, 'That wallet address could not be found', 'WALLET_NOT_FOUND');
    }
  },

  // Pasos 1 a 8 del checkout. `receiveValue` ya viene en unidades menores de la wallet del vendedor.
  async begin({ orderId, buyerWallet, sellerWallet, receiveValue, returnUrl }) {
    try {
      const client = await clientFactory();
      const receiver = await retryNetwork(() => client.walletAddress.get({ url: sellerWallet }));
      const sender = await retryNetwork(() => client.walletAddress.get({ url: buyerWallet }));
      if (receiver.id === sender.id) throw new HttpError(422, 'Buyer and seller wallets must be different', 'SAME_WALLET');

      const incomingAmount = { value: String(receiveValue), assetCode: receiver.assetCode, assetScale: receiver.assetScale };
      const incomingGrant = await client.grant.request(
        { url: receiver.authServer },
        { access_token: { access: [{ type: 'incoming-payment', actions: ['create', 'read'] }] } },
      );
      const incomingToken = tokenOf(incomingGrant, 'Incoming payment grant');
      const incoming = await client.incomingPayment.create(
        { url: base(receiver.resourceServer), accessToken: incomingToken },
        {
          walletAddress: receiver.id,
          incomingAmount,
          expiresAt: new Date(Date.now() + INCOMING_TTL_MS).toISOString(),
          metadata: { orderId: String(orderId) },
        },
      );

      const quoteGrant = await client.grant.request(
        { url: sender.authServer },
        { access_token: { access: [{ type: 'quote', actions: ['create', 'read'] }] } },
      );
      const quote = await client.quote.create(
        { url: base(sender.resourceServer), accessToken: tokenOf(quoteGrant, 'Quote grant') },
        { walletAddress: sender.id, receiver: incoming.id, method: 'ilp' },
      );

      const nonce = randomUUID();
      const outgoingGrant = await client.grant.request(
        { url: sender.authServer },
        {
          access_token: {
            access: [{ type: 'outgoing-payment', actions: ['create', 'read'], identifier: sender.id, limits: { debitAmount: quote.debitAmount } }],
          },
          interact: { start: ['redirect'], finish: { method: 'redirect', uri: returnUrl, nonce } },
        },
      );
      if (!outgoingGrant?.interact?.redirect) {
        throw new HttpError(502, 'The wallet did not ask for the buyer consent', 'PAYMENT_PROVIDER_ERROR');
      }
      return {
        providerRef: incoming.id,
        session: {
          nonce,
          finishNonce: outgoingGrant.interact.finish,
          redirectUrl: outgoingGrant.interact.redirect,
          continueUri: outgoingGrant.continue.uri,
          continueToken: outgoingGrant.continue.access_token.value,
          quoteId: quote.id,
          quoteExpiresAt: quote.expiresAt ? new Date(quote.expiresAt) : new Date(Date.now() + QUOTE_FALLBACK_MS),
          incomingPaymentId: incoming.id,
          incomingToken,
          buyerWallet: sender.id,
          sellerWallet: receiver.id,
          buyerAuthServer: sender.authServer,
          buyerResourceServer: sender.resourceServer,
          receiveValue: quote.receiveAmount.value,
          receiveAssetCode: quote.receiveAmount.assetCode,
          receiveAssetScale: quote.receiveAmount.assetScale,
          debitValue: quote.debitAmount.value,
          debitAssetCode: quote.debitAmount.assetCode,
          debitAssetScale: quote.debitAmount.assetScale,
        },
      };
    } catch (err) {
      throw wrap(err);
    }
  },

  // ¿El hash de vuelta corresponde a esta sesión? Se comprueba antes de tocar el estado o la red.
  verifyInteraction(session, hash, interactRef) {
    const expected = interactionHash(session.nonce, session.finishNonce, interactRef, session.buyerAuthServer);
    return Boolean(hash) && hashesMatch(expected, hash);
  },

  // Vuelta del navegador. Devuelve { status: 'paid' | 'failed', outgoingPaymentId }.
  // Un hash inválido lanza 400 antes de tocar la red; sin outgoing payment no hay cobro.
  async complete({ session, hash, interactRef }) {
    if (!this.verifyInteraction(session, hash, interactRef)) throw new HttpError(400, 'Invalid consent signature', 'INVALID_INTERACTION_HASH');
    try {
      const client = await clientFactory(); // conexión nueva: la anterior murió mientras la persona aprobaba
      const continued = await retryNetwork(() =>
        client.grant.continue({ url: session.continueUri, accessToken: session.continueToken }, { interact_ref: interactRef }),
      );
      const outgoingToken = tokenOf(continued, 'Continuation');
      const created = await retryNetwork(() =>
        client.outgoingPayment.create(
          { url: base(session.buyerResourceServer), accessToken: outgoingToken },
          { walletAddress: session.buyerWallet, quoteId: session.quoteId, metadata: { description: 'Axiom order' } },
        ),
      );
      let latest = created;
      for (let i = 0; i < pollOptions.attempts; i += 1) {
        if (latest.failed || latest.sentAmount.value === latest.debitAmount.value) break;
        await sleep(pollOptions.intervalMs);
        latest = await client.outgoingPayment.get({ url: created.id, accessToken: outgoingToken });
      }
      const incoming = await client.incomingPayment.get({ url: session.incomingPaymentId, accessToken: session.incomingToken });
      const delivered = BigInt(incoming.receivedAmount.value) >= BigInt(session.receiveValue);
      const sent = latest.sentAmount.value === latest.debitAmount.value;
      return { status: !latest.failed && sent && delivered ? 'paid' : 'failed', outgoingPaymentId: created.id };
    } catch (err) {
      throw wrap(err);
    }
  },

  // La devolución queda fuera de esta integración: se registra y la persona la hace por su cuenta.
  async refund() {
    return { providerRef: `manual_${randomUUID()}` };
  },
};
