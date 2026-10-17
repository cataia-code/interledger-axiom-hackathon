// Flujo de referencia para POST /api/v1/orders/:id/pay.
// El backend lo ejecuta dentro de un request: incoming payment, quote y grant.
// La persona solo aprueba en interact.redirect. El pedido pasa a pagado
// cuando sentAmount cubre debitAmount, el incoming recibió el monto y failed es false.
// El detalle del contrato con api/ está en ../INTEGRACION.md.

import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'

import { isPendingGrant, type AuthenticatedClient } from '@interledger/open-payments'

import {
  accessTokenOf,
  arg,
  describeSpread,
  formatAmount,
  openClient,
  required,
  resourceBase,
  retryNetwork,
  sleep,
  toMinorUnits,
  walletArg,
  type Amount
} from './lib.js'

const CALLBACK_PATH = '/callback'
const APPROVAL_TIMEOUT_MS = 10 * 60_000

function interactionHash(clientNonce: string, serverNonce: string, interactRef: string, grantUrl: string): string {
  return createHash('sha256')
    .update(`${clientNonce}\n${serverNonce}\n${interactRef}\n${grantUrl}`)
    .digest('base64')
}

function hashesMatch(expected: string, received: string): boolean {
  const unpadded = (value: string) => value.replace(/=+$/, '')
  return expected === received || unpadded(expected) === unpadded(received)
}

function openBrowser(url: string): void {
  const isWsl =
    process.platform === 'linux' &&
    readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')
  // cmd.exe corta la URL en el "&" de clientUri. PowerShell codificado no reinterpreta ese caracter.
  const child = isWsl
    ? spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-EncodedCommand',
          Buffer.from(`Start-Process '${url.replaceAll("'", "''")}'`, 'utf16le').toString('base64')
        ],
        { detached: true, stdio: 'ignore' }
      )
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], {
        detached: true,
        stdio: 'ignore'
      })
  child.on('error', () => {
    console.log('No pude abrir el navegador. Copia la URL completa de arriba.')
  })
  child.unref()
}

function waitForApproval(port: number): Promise<{ interactRef: string; hash: string }> {
  return new Promise((resolve, reject) => {
    let server: Server
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('Pasaron 10 minutos sin la aprobacion en la wallet de pruebas.'))
    }, APPROVAL_TIMEOUT_MS)

    server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
      const interactRef = url.searchParams.get('interact_ref')
      const hash = url.searchParams.get('hash')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      if (!interactRef || !hash) {
        response.end('<p>Esta pagina espera la redireccion de la wallet.</p>')
        return
      }
      response.end(
        '<!doctype html><meta charset="utf-8"><h1>Consentimiento recibido</h1><p>Vuelve a la terminal. El script sigue solo.</p>'
      )
      clearTimeout(timer)
      server.close()
      resolve({ interactRef, hash })
    })

    server.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    server.listen(port, '0.0.0.0')
  })
}

export async function runPay(): Promise<void> {
  const senderWalletUrl = walletArg('buyer')
  const receiverWalletUrl = walletArg('seller')
  const amount = arg('amount') ?? '1.00'
  const port = Number(required('PORT', '3344'))
  const nonce = randomUUID()
  const finishUri = `http://localhost:${port}${CALLBACK_PATH}`

  if (senderWalletUrl === receiverWalletUrl) {
    throw new Error('El comprador y el vendedor tienen que ser dos wallet addresses distintas.')
  }

  const open = (): Promise<AuthenticatedClient> => openClient()
  let client = await open()

  const receiver = await client.walletAddress.get({ url: receiverWalletUrl })
  const sender = await client.walletAddress.get({ url: senderWalletUrl })
  const incomingAmount: Amount = {
    value: toMinorUnits(amount, receiver.assetScale),
    assetCode: receiver.assetCode,
    assetScale: receiver.assetScale
  }

  console.log('Remitente:', sender.id, sender.assetCode, `scale ${sender.assetScale}`)
  console.log('Receptor: ', receiver.id, receiver.assetCode, `scale ${receiver.assetScale}`)
  console.log(
    `Pedido: que lleguen ${formatAmount(incomingAmount)} (la API guarda ${incomingAmount.value}, porque scale ${receiver.assetScale} son los decimales).`
  )

  const incomingGrant = await client.grant.request(
    { url: receiver.authServer },
    {
      access_token: {
        access: [{ type: 'incoming-payment', actions: ['create', 'read', 'complete'] }]
      }
    }
  )
  const incomingToken = accessTokenOf(incomingGrant, 'Grant de incoming payment')

  const incomingPayment = await client.incomingPayment.create(
    { url: resourceBase(receiver.resourceServer), accessToken: incomingToken },
    {
      walletAddress: receiver.id,
      incomingAmount,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      metadata: { description: 'Ejercicio Open Payments' }
    }
  )

  const quoteGrant = await client.grant.request(
    { url: sender.authServer },
    {
      access_token: {
        access: [{ type: 'quote', actions: ['create', 'read'] }]
      }
    }
  )
  const quoteToken = accessTokenOf(quoteGrant, 'Grant de quote')

  const quote = await client.quote.create(
    { url: resourceBase(sender.resourceServer), accessToken: quoteToken },
    {
      walletAddress: sender.id,
      receiver: incomingPayment.id,
      method: 'ilp'
    }
  )
  console.log('\nCotizacion')
  console.log('  Llega: ', formatAmount(quote.receiveAmount))
  console.log('  Sale:  ', formatAmount(quote.debitAmount))
  console.log(' ', describeSpread(quote.receiveAmount, quote.debitAmount))
  if (quote.expiresAt) console.log('  Vence: ', quote.expiresAt)

  const approval = waitForApproval(port)
  const outgoingGrant = await client.grant.request(
    { url: sender.authServer },
    {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['create', 'read'],
            identifier: sender.id,
            limits: { debitAmount: quote.debitAmount }
          }
        ]
      },
      interact: {
        start: ['redirect'],
        finish: { method: 'redirect', uri: finishUri, nonce }
      }
    }
  )
  if (!isPendingGrant(outgoingGrant)) {
    throw new Error('El grant de outgoing payment deberia quedar pendiente de interaccion.')
  }

  console.log('\nAprueba en el navegador. La URL tiene que incluir clientUri:')
  console.log(outgoingGrant.interact.redirect)
  openBrowser(outgoingGrant.interact.redirect)

  const callback = await approval
  const expectedHash = interactionHash(
    nonce,
    outgoingGrant.interact.finish,
    callback.interactRef,
    sender.authServer
  )
  if (!hashesMatch(expectedHash, callback.hash)) {
    await client.incomingPayment.complete({
      url: incomingPayment.id,
      accessToken: incomingToken
    })
    throw new Error('El hash de la redireccion no coincide. El cobro quedo cerrado y no se creo el outgoing payment.')
  }
  console.log('\nConsentimiento verificado.')

  // La aprobacion tarda lo bastante para que la conexion anterior ya este cerrada.
  client = await open()
  const continued = await retryNetwork('Continuar el grant', () =>
    client.grant.continue(
      {
        url: outgoingGrant.continue.uri,
        accessToken: outgoingGrant.continue.access_token.value
      },
      { interact_ref: callback.interactRef }
    )
  )
  const outgoingToken = accessTokenOf(continued, 'Continuation del outgoing payment')

  const created = await retryNetwork('Crear el outgoing payment', () =>
    client.outgoingPayment.create(
      { url: resourceBase(sender.resourceServer), accessToken: outgoingToken },
      {
        walletAddress: sender.id,
        quoteId: quote.id,
        metadata: { description: 'Ejercicio Open Payments' }
      }
    )
  )
  let latest = created
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    if (latest.failed || latest.sentAmount.value === latest.debitAmount.value) break
    await sleep(2000)
    latest = await client.outgoingPayment.get({
      url: created.id,
      accessToken: outgoingToken
    })
  }

  const incomingAfter = await client.incomingPayment.get({
    url: incomingPayment.id,
    accessToken: incomingToken
  })

  console.log('\nCierre')
  console.log('  Salio:   ', formatAmount(latest.sentAmount), 'de', formatAmount(latest.debitAmount), 'cotizados')
  console.log('  Llego:   ', formatAmount(incomingAfter.receivedAmount), 'de', formatAmount(quote.receiveAmount), 'cotizados')
  console.log(' ', describeSpread(incomingAfter.receivedAmount, latest.sentAmount))
  console.log('  Cobro:   ', incomingAfter.completed ? 'completo' : 'abierto')
  console.log('  Fallo:   ', latest.failed ? 'si' : 'no')
}
