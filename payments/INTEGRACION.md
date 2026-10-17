# Cómo integrar el pago

`payments/src/pay.ts` es el flujo ya probado contra la red de pruebas de Interledger. Hay que llevarlo al backend, sin copiar la terminal. Sigue siendo dinero de juego.

La app firma con `CLIENT_WALLET_ADDRESS`, `KEY_ID` y `private.key`. Eso identifica al backend, no a un usuario, y sí puede vivir en el entorno. La llave pública tiene que estar en `{CLIENT_WALLET_ADDRESS}/jwks.json`. No se sube `private.key`.

Quien paga y quien cobra salen de la base. Cada usuario puede tener varias wallets y una sola es la principal. El comprador paga con la suya. La tienda cobra con la principal del usuario dueño de esa tienda. Si a alguno le falta, el pedido no se puede pagar.

SDK: `@interledger/open-payments`. No reimplementes la firma HTTP. El script recibe las dos wallets así:

```bash
npm run pay -- --buyer <url del comprador> --seller <url de la tienda> --amount 10.00
```

## Montos

La API guarda enteros. `assetScale` son los decimales: `10.00 EUR` con escala 2 se envía como `"1000"`.

`--amount` es lo que debe recibir la tienda, en la moneda de su wallet. Lo que se le debita al comprador lo dice la cotización. No hardcodees la comisión. En las pruebas EUR a EUR de esta red, recibir 1.00 costó 2.00 y recibir 10.00 costó 11.00: sobró 1.00 EUR fijo. Muéstralo y deja que el comprador lo acepte. Si las monedas difieren, muestra lo que sale y lo que llega.

La cotización de esta red dura unos cinco minutos. El consentimiento tiene que terminar antes. Si vence, se cotiza de nuevo. No se reutiliza.

## 1. Empezar el checkout

Recibe el id del pedido. Busca la wallet principal del comprador y la de la tienda.

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
