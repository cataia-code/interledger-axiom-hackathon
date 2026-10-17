# Cómo integrar el pago

`payments/src/pay.ts` es el flujo ya probado contra la red de pruebas de Interledger. Hay que llevarlo al checkout, sin copiar la terminal. Sigue siendo dinero de juego.

Este documento cubre solo el cobro. Con la URL de la wallet del comprador y la URL de la wallet del vendedor se puede pagar. La devolución queda fuera.

La URL es el id de la wallet. Open Payments no tiene un listado de wallets: cada cuenta se consulta con un `GET` a la URL que ya se tiene.

## Qué aporta cada lado en un pago

Ejemplo: el comprador escanea el QR de un comercio por 20000 pesos colombianos.

El QR (o la ficha del comercio) ya trae tres datos:

- la URL de la wallet del vendedor
- el monto, `20000`
- la moneda, `COP`

La wallet del comprador no se busca en Interledger en ese momento. Se guardó antes, cuando la persona vinculó su cuenta en la app. El front, con el usuario ya logueado, llama al checkout y manda esa URL guardada junto con los datos del QR. La persona no abre Interledger, no copia un id y no vuelve a la app para pegarlo.

El backend responde con la cotización y con `interact.redirect`. El front abre esa URL. Ahí la entidad de la cuenta pregunta si autoriza el débito. Ese es el único paso que la persona hace al pagar, además de escanear.

Pagar con Bancolombia quiere decir que la wallet guardada del comprador es una cuenta de ese banco. El banco, al vincular la cuenta, entrega la URL una sola vez y la app la guarda. En la red de pruebas esa entidad es la wallet de Interledger: crear la cuenta en [wallet.interledger-test.dev](https://wallet.interledger-test.dev) y guardar la URL en el perfil reemplaza ese vínculo, y también se hace una sola vez por usuario.

El checkout recibe:

- `sellerWallet`: URL que vino en el QR
- `amount` y la moneda del QR (`20000`, `COP`)
- `buyerWallet`: la URL ya guardada del usuario logueado. La manda el front o la lee el backend del perfil. En los dos casos la persona no la escribe.

El script de prueba hace lo mismo por consola:

```bash
npm run pay -- --buyer <url guardada del comprador> --seller <url del QR> --amount 20000
```

## Identidad de la app

La app firma con `CLIENT_WALLET_ADDRESS`, `KEY_ID` y `private.key`. Eso identifica al backend, no a un usuario, y sí puede vivir en el entorno. La llave pública tiene que estar en `{CLIENT_WALLET_ADDRESS}/jwks.json`. No se sube `private.key`.

SDK: `@interledger/open-payments`. No reimplementes la firma HTTP.

Si al comprador o al vendedor le falta la URL, el pedido no se puede pagar.

## Montos

La API guarda enteros. `assetScale` son los decimales y sale del `GET` de la wallet del vendedor. `10.00 EUR` con escala 2 se envía como `"1000"`. `20000` COP con escala 0 se envía como `"20000"`; con escala 2, como `"2000000"`.

`--amount` es lo que debe recibir la tienda, en la moneda de su wallet. Lo que se le debita al comprador lo dice la cotización. No hardcodees la comisión. En las pruebas EUR a EUR de esta red, recibir 1.00 costó 2.00 y recibir 10.00 costó 11.00: sobró 1.00 EUR fijo. Muéstralo y deja que el comprador lo acepte. Si las monedas difieren, muestra lo que sale y lo que llega.

La cotización de esta red dura unos cinco minutos. El consentimiento tiene que terminar antes. Si vence, se cotiza de nuevo. No se reutiliza.

## 1. Empezar el checkout

Recibe el id del pedido, la wallet del vendedor, el monto y la moneda. La wallet del comprador es la que ya está guardada en su perfil.

1. `GET` de las dos wallet addresses.
2. Grant `incoming-payment` con acciones `create` y `read`, en el `authServer` de la tienda. No pide consentimiento.
3. Crea el incoming payment por el total del pedido. Pon el id del pedido en `metadata` y un `expiresAt` de unos 30 minutos.
4. Grant `quote` con acciones `create` y `read`, en el `authServer` del comprador.
5. Crea el quote con `receiver` igual al id del incoming payment y `method: "ilp"`.
6. Grant `outgoing-payment` con acciones `create` y `read`, en el `authServer` del comprador. `identifier` es la wallet del comprador. `limits.debitAmount` es el `debitAmount` del quote, no un monto mayor. `interact.start` es `redirect`. `interact.finish` es `redirect`, con la URL de vuelta de este pedido y un `nonce` nuevo.
7. Guarda esto antes de responder. Hace falta cuando el navegador vuelva: `nonce`, `interact.finish`, `continue.uri`, `continue.access_token`, `quote.id`, `quote.expiresAt`, id del incoming payment, `authServer` del comprador, los dos montos y el id del pedido.
8. Responde al front con lo que llega, lo que sale, la comisión, el vencimiento y `interact.redirect`.

El front redirige al comprador a esa URL. Trae `clientUri`. No la cortes en el `&`.

## 2. Volver de la aprobación

La wallet llama la URL de vuelta con `hash` e `interact_ref`. El id del pedido va en esa URL desde el paso 6, porque el callback no lo manda solo.

1. Carga lo que guardaste.
2. Verifica el hash antes de seguir. Es el Base64 de SHA-256 de cuatro líneas separadas por `\n`, en este orden: el `nonce` que enviaste, `interact.finish`, `interact_ref` y la URL del `authServer` del comprador. Si no coincide, no continúes.
3. Abre un cliente HTTP nuevo. La conexión anterior muere mientras la persona aprueba. Si falla por red (`fetch failed`), reintenta.
4. `grant.continue` con el token, la URI guardados y el `interact_ref`.
5. Crea el outgoing payment con `quoteId`.
6. Consulta el outgoing payment hasta que `sentAmount` iguale `debitAmount` o `failed` sea true. Consulta el incoming payment con su token.
7. El pedido queda pagado solo si llegó el monto cotizado y `failed` es false. Volver al navegador no alcanza como prueba de pago.

Negar el consentimiento deja el pedido sin pagar. Un hash inválido no crea el outgoing payment.
