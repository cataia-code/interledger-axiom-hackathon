// Consulta suelta de cobros ya creados. El checkout no lista ni lee esta vista para pagar.

import { accessTokenOf, arg, formatAmount, openClient, resourceBase, type Amount } from './lib.js'

function printAmount(label: string, amount: Amount | undefined): void {
  console.log(`  ${label}: ${amount ? formatAmount(amount) : '(sin monto)'}`)
}

export async function runIncoming(): Promise<void> {
  const paymentUrl = arg('url')
  const walletUrl = arg('wallet')
  if (!paymentUrl && !walletUrl) {
    throw new Error('Usa --wallet con la wallet de la tienda, o --url con un incoming payment.')
  }

  const client = await openClient()

  if (paymentUrl) {
    if (!/^https?:\/\//.test(paymentUrl)) {
      throw new Error('--url tiene que ser la URL de un incoming payment.')
    }
    const payment = await client.incomingPayment.getPublic({ url: paymentUrl })
    console.log('Incoming publico:', paymentUrl)
    console.log('Auth:            ', payment.authServer)
    printAmount('Recibido', payment.receivedAmount)
    console.log('La vista publica trae lo ya recibido y el auth server. El monto pedido sale con el token del cobro.')
  }

  if (!walletUrl) return
  if (!/^https?:\/\//.test(walletUrl)) {
    throw new Error('--wallet tiene que ser una wallet address.')
  }

  const wallet = await client.walletAddress.get({ url: walletUrl })
  const grant = await client.grant.request(
    { url: wallet.authServer },
    {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['list', 'read'],
            identifier: wallet.id
          }
        ]
      }
    }
  )
  const token = accessTokenOf(grant, 'Grant para listar incoming payments')
  const page = await client.incomingPayment.list(
    {
      url: resourceBase(wallet.resourceServer),
      accessToken: token,
      walletAddress: wallet.id
    },
    { first: 20, 'wallet-address': wallet.id }
  )

  console.log(`\nCobros de ${wallet.id}: ${page.result.length}`)
  if (page.result.length === 0) {
    console.log('Esta wallet no tiene cobros en esta pagina.')
    return
  }
  for (const payment of page.result) {
    console.log('\n-', payment.id)
    printAmount('Pedido  ', payment.incomingAmount)
    printAmount('Recibido', payment.receivedAmount)
    console.log('  Estado:  ', payment.completed ? 'cerrado' : 'abierto')
    if (payment.expiresAt) console.log('  Vence:   ', payment.expiresAt)
    const description = payment.metadata?.description
    if (typeof description === 'string') console.log('  Nota:    ', description)
  }
}
