// Consulta suelta de una wallet address. El checkout no la llama por separado.

import { formatAmount, openClient, walletArg } from './lib.js'

export async function runWallet(): Promise<void> {
  const url = walletArg('url')
  const client = await openClient()
  const wallet = await client.walletAddress.get({ url })

  console.log('Wallet:   ', wallet.id)
  console.log('Nombre:   ', wallet.publicName ?? '(sin nombre publico)')
  console.log('Moneda:   ', wallet.assetCode, `scale ${wallet.assetScale}`)
  console.log('Auth:     ', wallet.authServer)
  console.log('Recursos: ', wallet.resourceServer)
}
