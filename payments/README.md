# payments

Cliente de prueba de Open Payments. Vive en `payments/`; ejecuta los comandos desde esa carpeta.

Recorre un pago contra la red de pruebas de Interledger e imprime la cotización, la comisión y el cierre. Usa dinero de juego. Hacen falta dos wallet addresses: una paga y otra recibe.

Para llevar este flujo al checkout de `api/`, la instrucción está en [INTEGRACION.md](INTEGRACION.md).

## Requisitos

- Node.js >= 20
- npm

## Instalación

```bash
npm install
cp .env.example .env
```

1. Crea una cuenta en [wallet.interledger-test.dev](https://wallet.interledger-test.dev). Los pasos de KYC aceptan datos falsos, salvo el correo. La guía está en [Before you begin](https://openpayments.dev/sdk/before-you-begin/).
2. Crea dos cuentas dentro del dashboard, cada una con su wallet address. Deposita saldo de prueba en la que va a pagar.
3. En Settings, pestaña Developer Keys, genera una llave para la cuenta que paga. Se descarga `private.key`. Copia el key ID que queda en pantalla.
4. Pega en `.env` solo la wallet de la app, el key ID y la ruta de `private.key`.

`.env` guarda la identidad que firma. No guarda compradores ni vendedores. Esas dos wallets entran en cada ejecución, igual que en el checkout: la del usuario que paga y la de la tienda que cobra.

`.env` y `private.key` no se suben al repo.

## Pago

```bash
npm run pay -- --buyer https://ilp.interledger-test.dev/quien-paga --seller https://ilp.interledger-test.dev/quien-cobra --amount 10.00
```

`--buyer` es quien paga. `--seller` es quien recibe. `--amount` es lo que debe llegar, en la moneda de su cuenta. Si lo omites, usa `1.00`.

El script imprime una URL. Ábrela, inicia sesión con la cuenta que paga y aprueba. Esa aprobación es el único paso de la persona. La wallet vuelve a `http://localhost:3344/callback` y el script termina solo. Con `assetScale` 2, `10.00` se envía a la API como `1000`.
