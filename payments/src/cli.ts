import { runIncoming } from './incoming.js'
import { reportError } from './lib.js'
import { runPay } from './pay.js'
import { runQuote } from './quote.js'
import { runWallet } from './wallet.js'

const usage = `El pago es un solo comando:

  npm run pay -- --buyer <wallet> --seller <wallet> --amount 10.00

Abre el navegador, la persona aprueba y el script termina.

Estas consultas no forman parte del cobro:

  npm run op -- wallet --url <wallet>
  npm run op -- quote --buyer <wallet> --seller <wallet> --amount 10.00
  npm run op -- incoming --wallet <wallet>
`

async function main(): Promise<void> {
  const command = process.argv[2]
  if (!command || command === '--help' || command === '-h' || command.startsWith('--')) {
    console.log(usage)
    return
  }
  if (command === 'wallet') return runWallet()
  if (command === 'quote') return runQuote()
  if (command === 'pay') return runPay()
  if (command === 'incoming') return runIncoming()
  throw new Error(`Comando desconocido: ${command}\n\n${usage}`)
}

main().catch(reportError)
