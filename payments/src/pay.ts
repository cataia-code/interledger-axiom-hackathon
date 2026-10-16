import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  createAuthenticatedClient,
  isFinalizedGrantWithAccessToken,
  isPendingGrant,
  OpenPaymentsClientError,
  type AuthenticatedClient,
  type Grant,
  type PendingGrant
} from '@interledger/open-payments'
import 'dotenv/config'

type Amount = {
  value: string
  assetCode: string
  assetScale: number
}

const CALLBACK_PATH = '/callback'
const APPROVAL_TIMEOUT_MS = 10 * 60_000

function required(name: string, fallback?: string): string {
  const value = process.env[name]?.trim() || fallback?.trim()
  if (!value) {
    throw new Error(`Falta ${name} en .env. Copia .env.example y completa la llave del cliente.`)
  }
  return value
}

function arg(name: string): string | undefined {
  const flag = `--${name}`
  const index = process.argv.indexOf(flag)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value || value.startsWith('--')) return undefined
  return value.trim()
}

function walletArg(name: string): string {
  const value = arg(name)
  if (!value || !/^https?:\/\//.test(value)) {
    throw new Error(
      `Falta --${name} con una wallet address. El comprador y el vendedor llegan en cada pago, no van en .env.`
    )
  }
  return value
}

function resourceBase(url: string): string {
  return url.replace(/\/+$/, '')
}

function toMinorUnits(amount: string, scale: number): string {
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error(`AMOUNT debe ser un decimal como 1.00. Recibido: ${amount}`)
  }
  const [whole, fraction = ''] = amount.split('.')
  if (fraction.length > scale) {
    throw new Error(
      `AMOUNT tiene ${fraction.length} decimales y la moneda del receptor usa ${scale}.`
    )
  }
  const minor =
    BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0') || '0')
  return minor.toString()
}

function formatAmount(amount: Amount): string {
  const digits = amount.value.padStart(amount.assetScale + 1, '0')
  if (amount.assetScale === 0) return `${digits} ${amount.assetCode}`
  const whole = digits.slice(0, -amount.assetScale)
  const fraction = digits.slice(-amount.assetScale)
  return `${whole}.${fraction} ${amount.assetCode}`
}

function majorUnits(amount: Amount): number {
  const digits = amount.value.padStart(amount.assetScale + 1, '0')
  if (amount.assetScale === 0) return Number(digits)
  const whole = digits.slice(0, -amount.assetScale)
  const fraction = digits.slice(-amount.assetScale)
  return Number(`${whole}.${fraction}`)
}

function describeSpread(receive: Amount, debit: Amount): string {
  if (receive.assetCode === debit.assetCode && receive.assetScale === debit.assetScale) {
    const fee = BigInt(debit.value) - BigInt(receive.value)
    const feeAmount: Amount = {
      value: fee.toString(),
      assetCode: debit.assetCode,
      assetScale: debit.assetScale
    }
    const percent = (Number(fee) / Number(receive.value)) * 100
    return `Comision: ${formatAmount(feeAmount)} (${percent.toFixed(2)}% de lo recibido)`
  }
  const rate = majorUnits(debit) / majorUnits(receive)
  return `Cambio cotizado: ${rate.toFixed(4)} ${debit.assetCode} por cada 1 ${receive.assetCode}`
}

function accessTokenOf(grant: PendingGrant | Grant, label: string): string {
  if (!isFinalizedGrantWithAccessToken(grant)) {
    throw new Error(
      `${label} no devolvio un access token listo para usar.\n${JSON.stringify(grant, null, 2)}`
    )
  }
  return grant.access_token.value
}

function privateKeyMaterial(filePath: string): string {
  const raw = readFileSync(filePath, 'utf8').trim()
  if (raw.includes('BEGIN')) return filePath
  const decoded = Buffer.from(raw, 'base64').toString('utf8')
  if (decoded.includes('BEGIN')) return decoded
  return filePath
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof OpenPaymentsClientError) && !(error instanceof Error)) return false
  const description = error instanceof OpenPaymentsClientError ? error.description : ''
  const text = `${error.message} ${description}`.toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('timed out') ||
    text.includes('timeout') ||
    text.includes('econnreset') ||
    text.includes('socket')
  )
}

async function retryNetwork<T>(label: string, action: () => Promise<T>): Promise<T> {
  const attempts = 3
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      if (attempt === attempts || !isNetworkFailure(error)) throw error
      console.log(
        `\n${label}: la conexion con la red de pruebas se corto. Reintento ${attempt + 1} de ${attempts}.`
      )
      await sleep(1000 * attempt)
    }
  }
  throw new Error(`${label}: se agotaron los reintentos.`)
}

async function main(): Promise<void> {
  const senderWalletUrl = walletArg('buyer')
  const receiverWalletUrl = walletArg('seller')
  const clientWalletUrl = required('CLIENT_WALLET_ADDRESS')
  const keyId = required('KEY_ID')
  const privateKeyPath = resolve(required('PRIVATE_KEY_PATH'))
  const amount = arg('amount') ?? '1.00'
  const port = Number(required('PORT', '3344'))
  const nonce = randomUUID()
  const finishUri = `http://localhost:${port}${CALLBACK_PATH}`

  if (senderWalletUrl === receiverWalletUrl) {
    throw new Error('SENDER y RECEIVER tienen que ser dos wallet addresses distintas.')
  }

  const openClient = (): Promise<AuthenticatedClient> =>
    createAuthenticatedClient({
      walletAddressUrl: clientWalletUrl,
      privateKey: privateKeyMaterial(privateKeyPath),
      keyId,
      requestTimeoutMs: 20_000
    })

  let client = await openClient()

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

  const incomingGrantBody = {
    access_token: {
      access: [{ type: 'incoming-payment' as const, actions: ['create' as const, 'read' as const] }]
    }
  }
  const incomingGrant = await client.grant.request(
    { url: receiver.authServer },
    incomingGrantBody
  )
  const incomingToken = accessTokenOf(incomingGrant, 'Grant de incoming payment')

  const incomingBody = {
    walletAddress: receiver.id,
    incomingAmount,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    metadata: { description: 'Ejercicio Open Payments' }
  }
  const incomingPayment = await client.incomingPayment.create(
    { url: resourceBase(receiver.resourceServer), accessToken: incomingToken },
    incomingBody
  )

  const quoteGrantBody = {
    access_token: {
      access: [{ type: 'quote' as const, actions: ['create' as const, 'read' as const] }]
    }
  }
  const quoteGrant = await client.grant.request({ url: sender.authServer }, quoteGrantBody)
  const quoteToken = accessTokenOf(quoteGrant, 'Grant de quote')

  const quoteBody = {
    walletAddress: sender.id,
    receiver: incomingPayment.id,
    method: 'ilp' as const
  }
  const quote = await client.quote.create(
    { url: resourceBase(sender.resourceServer), accessToken: quoteToken },
    quoteBody
  )
  console.log('\nCotizacion')
  console.log('  Llega: ', formatAmount(quote.receiveAmount))
  console.log('  Sale:  ', formatAmount(quote.debitAmount))
  console.log(' ', describeSpread(quote.receiveAmount, quote.debitAmount))
  if (quote.expiresAt) console.log('  Vence: ', quote.expiresAt)

  const approval = waitForApproval(port)
  const outgoingGrantBody = {
    access_token: {
      access: [
        {
          type: 'outgoing-payment' as const,
          actions: ['create' as const, 'read' as const],
          identifier: sender.id,
          limits: { debitAmount: quote.debitAmount }
        }
      ]
    },
    interact: {
      start: ['redirect' as const],
      finish: { method: 'redirect' as const, uri: finishUri, nonce }
    }
  }
  const outgoingGrant = await client.grant.request(
    { url: sender.authServer },
    outgoingGrantBody
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
  const hashOk = hashesMatch(expectedHash, callback.hash)
  if (!hashOk) {
    throw new Error('El hash de la redireccion no coincide. No se continua el grant.')
  }
  console.log('\nConsentimiento verificado.')

  // La aprobacion tarda lo bastante para que la conexion anterior ya este cerrada.
  client = await openClient()
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

  const outgoingBody = {
    walletAddress: sender.id,
    quoteId: quote.id,
    metadata: { description: 'Ejercicio Open Payments' }
  }
  const created = await retryNetwork('Crear el outgoing payment', () =>
    client.outgoingPayment.create(
      { url: resourceBase(sender.resourceServer), accessToken: outgoingToken },
      outgoingBody
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

main().catch((error: unknown) => {
  if (error instanceof OpenPaymentsClientError) {
    console.error('\nLa API rechazo la peticion.')
    console.error(error.message)
    if (error.status) console.error('HTTP', error.status)
    if (error.code) console.error('codigo', error.code)
    if (error.description) console.error(error.description)
    if (error.cause instanceof Error) console.error(error.cause.message)
    if (error.validationErrors?.length) console.error(error.validationErrors.join('\n'))
    if (error.details) console.error(JSON.stringify(error.details, null, 2))
  } else if (error instanceof Error) {
    console.error(`\n${error.message}`)
  } else {
    console.error(error)
  }
  process.exitCode = 1
})
