import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  createAuthenticatedClient,
  isFinalizedGrantWithAccessToken,
  OpenPaymentsClientError,
  type AuthenticatedClient,
  type Grant,
  type PendingGrant
} from '@interledger/open-payments'
import 'dotenv/config'

export type Amount = {
  value: string
  assetCode: string
  assetScale: number
}

export function required(name: string, fallback?: string): string {
  const value = process.env[name]?.trim() || fallback?.trim()
  if (!value) {
    throw new Error(`Falta ${name} en .env. Copia .env.example y completa la llave del cliente.`)
  }
  return value
}

export function arg(name: string): string | undefined {
  const flag = `--${name}`
  const index = process.argv.indexOf(flag)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value || value.startsWith('--')) return undefined
  return value.trim()
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

export function walletArg(name: string): string {
  const value = arg(name)
  if (!value || !/^https?:\/\//.test(value)) {
    throw new Error(
      `Falta --${name} con una wallet address. El comprador y el vendedor llegan en cada pago, no van en .env.`
    )
  }
  return value
}

export function resourceBase(url: string): string {
  return url.replace(/\/+$/, '')
}

export function toMinorUnits(amount: string, scale: number): string {
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error(`El monto debe ser un decimal como 1.00 o 20000. Recibido: ${amount}`)
  }
  const [whole, fraction = ''] = amount.split('.')
  if (fraction.length > scale) {
    throw new Error(
      `El monto tiene ${fraction.length} decimales y la moneda usa ${scale}.`
    )
  }
  const minor =
    BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0') || '0')
  return minor.toString()
}

export function formatAmount(amount: Amount): string {
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

export function describeSpread(receive: Amount, debit: Amount): string {
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

export function accessTokenOf(grant: PendingGrant | Grant, label: string): string {
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

export function openClient(): Promise<AuthenticatedClient> {
  return createAuthenticatedClient({
    walletAddressUrl: required('CLIENT_WALLET_ADDRESS'),
    privateKey: privateKeyMaterial(resolve(required('PRIVATE_KEY_PATH'))),
    keyId: required('KEY_ID'),
    requestTimeoutMs: 20_000
  })
}

export function sleep(ms: number): Promise<void> {
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

export async function retryNetwork<T>(label: string, action: () => Promise<T>): Promise<T> {
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

export function reportError(error: unknown): void {
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
}
