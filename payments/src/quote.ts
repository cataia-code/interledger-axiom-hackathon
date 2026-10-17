// Consulta suelta. No es un paso del checkout: pay.ts ya cotiza antes de aprobar.

import {
  accessTokenOf,
  arg,
  describeSpread,
  formatAmount,
  hasFlag,
  openClient,
  resourceBase,
  toMinorUnits,
  walletArg,
  type Amount
} from './lib.js'

export async function runQuote(): Promise<void> {
  const buyerUrl = walletArg('buyer')
  const sellerUrl = walletArg('seller')
  const amount = arg('amount') ?? '1.00'
  const debitSide = hasFlag('debit')

  if (buyerUrl === sellerUrl) {
    throw new Error('El comprador y el vendedor tienen que ser dos wallet addresses distintas.')
  }

  const client = await openClient()
  const seller = await client.walletAddress.get({ url: sellerUrl })
  const buyer = await client.walletAddress.get({ url: buyerUrl })
  const priced = debitSide ? buyer : seller
  const amountValue: Amount = {
    value: toMinorUnits(amount, priced.assetScale),
    assetCode: priced.assetCode,
    assetScale: priced.assetScale
  }

  console.log('Comprador:', buyer.id, buyer.assetCode, `scale ${buyer.assetScale}`)
  console.log('Vendedor: ', seller.id, seller.assetCode, `scale ${seller.assetScale}`)
  console.log(
    debitSide
      ? `Cotizar cuanto llega si salen ${formatAmount(amountValue)}.`
      : `Cotizar cuanto sale para que lleguen ${formatAmount(amountValue)}.`
  )

  const incomingGrant = await client.grant.request(
    { url: seller.authServer },
    {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['create', 'complete'],
            identifier: seller.id
          }
        ]
      }
    }
  )
  const incomingToken = accessTokenOf(incomingGrant, 'Grant de incoming payment')
  const incomingPayment = await client.incomingPayment.create(
    { url: resourceBase(seller.resourceServer), accessToken: incomingToken },
    debitSide
      ? {
          walletAddress: seller.id,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          metadata: { description: 'Cotizacion de prueba, se cierra al terminar' }
        }
      : {
          walletAddress: seller.id,
          incomingAmount: amountValue,
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          metadata: { description: 'Cotizacion de prueba, se cierra al terminar' }
        }
  )

  const quoteGrant = await client.grant.request(
    { url: buyer.authServer },
    {
      access_token: {
        access: [{ type: 'quote', actions: ['create', 'read'] }]
      }
    }
  )
  const quoteToken = accessTokenOf(quoteGrant, 'Grant de quote')
  const quote = await client.quote.create(
    { url: resourceBase(buyer.resourceServer), accessToken: quoteToken },
    debitSide
      ? {
          walletAddress: buyer.id,
          receiver: incomingPayment.id,
          method: 'ilp',
          debitAmount: amountValue
        }
      : {
          walletAddress: buyer.id,
          receiver: incomingPayment.id,
          method: 'ilp'
        }
  )

  console.log('\nCotizacion')
  console.log('  Llega: ', formatAmount(quote.receiveAmount))
  console.log('  Sale:  ', formatAmount(quote.debitAmount))
  console.log(' ', describeSpread(quote.receiveAmount, quote.debitAmount))
  if (quote.expiresAt) console.log('  Vence: ', quote.expiresAt)

  await client.incomingPayment.complete({
    url: incomingPayment.id,
    accessToken: incomingToken
  })
  console.log('\nCobro de prueba cerrado. No queda esperando un pago.')
}
