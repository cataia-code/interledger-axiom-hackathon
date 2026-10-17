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

La wallet del buyer no se busca en Interledger en ese momento. Quedó guardada cuando vinculó la cuenta. Con la sesión abierta, el front llama `POST /api/v1/orders/:id/pay`. La persona no abre Interledger, no copia un id y no vuelve a la app para pegarlo.

El backend hace en ese mismo request el incoming payment, la cotización y el grant. Responde con `payment`, `debitAmount` y `redirectUrl`. El front muestra una sola pantalla: Monto (`payment.amount`) y Desde tu wallet (`debitAmount`), y un botón. Ese botón abre `redirectUrl`. Ahí la entidad de la cuenta pide la aprobación, que es el único paso fuera de la app.

`payments/` no es un microservicio. Es el flujo de referencia. El cobro vive en un módulo del backend que ya existe: el front nunca firma, nunca ve `private.key` y nunca habla con Interledger. El módulo es el único que tiene la llave, arma el grant y marca el pedido pagado.

Pagar con Bancolombia quiere decir que la wallet guardada del comprador es una cuenta de ese banco. El banco, al vincular la cuenta, entrega la URL una sola vez y la app la guarda. En la red de pruebas esa entidad es la wallet de Interledger: crear la cuenta en [wallet.interledger-test.dev](https://wallet.interledger-test.dev) y guardar la URL en el perfil reemplaza ese vínculo, y también se hace una sola vez por usuario.

El cobro ya tiene endpoint: `POST /api/v1/orders/:id/pay`, con el buyer autenticado. El body no vuelve a mandar el monto. Sale del `order`: `totalAmount` y `currency` en unidades menores, más `buyerId` y `storeId`. La wallet del buyer y la del dueño del `store` se leen en el servidor. En el front la tienda se llama `shop`; al hablar con la API el nombre es `store`.

La respuesta sigue el JSON del back, en camelCase: el `payment` con `id`, `orderId`, `provider`, `providerRef`, `status`, `amount`, `currency`, y al lado `debitAmount` (lo que sale de la wallet) y `redirectUrl`. `amount` es lo que recibe la tienda. La diferencia es el fee de la red. `commissionAmount` del `order` es otra cosa: la comisión de Lokora, no este fee.

El script de prueba arma ese mismo cobro por consola:

```bash
npm run pay -- --buyer <url guardada del comprador> --seller <url del QR> --amount 20000
```

## Identidad de la app

La app firma con `CLIENT_WALLET_ADDRESS`, `KEY_ID` y `private.key`. Eso identifica al backend, no a un usuario, y sí puede vivir en el entorno. La llave pública tiene que estar en `{CLIENT_WALLET_ADDRESS}/jwks.json`. No se sube `private.key`.

SDK: `@interledger/open-payments`. No reimplementes la firma HTTP.

Si al comprador o al vendedor le falta la URL, el pedido no se puede pagar.

## Montos

La API guarda enteros. `assetScale` son los decimales y sale del `GET` de la wallet del vendedor. `10.00 EUR` con escala 2 se envía como `"1000"`. `20000` COP con escala 0 se envía como `"20000"`; con escala 2, como `"2000000"`.

`--amount` es lo que debe recibir la tienda, en la moneda de su wallet. Lo que se le debita al comprador lo dice la cotización y viaja en el límite del grant, así la pantalla de aprobación ya muestra el débito real. No hardcodees la comisión. En las pruebas EUR a EUR de esta red, recibir 1.00 costó 2.00 y recibir 10.00 costó 11.00: sobró 1.00 EUR fijo.

La cotización de esta red dura unos cinco minutos. El consentimiento tiene que terminar antes. Si vence, se cotiza de nuevo. No se reutiliza.

## 1. Empezar el checkout

Un solo endpoint, `POST /api/v1/orders/:id/pay`. El id del pedido va en la ruta. `totalAmount` y `currency` salen del `order`. Las dos wallets se leen en el servidor. Los pasos de abajo son trabajo del backend dentro de esa petición, antes de responder.

1. `GET` de las dos wallet addresses.
2. Grant `incoming-payment` con acciones `create` y `read`, en el `authServer` de la tienda. No pide consentimiento.
3. Crea el incoming payment por el total del pedido. Pon el id del pedido en `metadata` y un `expiresAt` de unos 30 minutos.
4. Grant `quote` con acciones `create` y `read`, en el `authServer` del comprador.
5. Crea el quote con `receiver` igual al id del incoming payment y `method: "ilp"`.
6. Grant `outgoing-payment` con acciones `create` y `read`, en el `authServer` del comprador. `identifier` es la wallet del comprador. `limits.debitAmount` es el `debitAmount` del quote, no un monto mayor. `interact.start` es `redirect`. `interact.finish` es `redirect`, con la URL de vuelta de este pedido y un `nonce` nuevo.
7. Guarda esto antes de responder. Hace falta cuando el navegador vuelva: `nonce`, `interact.finish`, `continue.uri`, `continue.access_token`, `quote.id`, `quote.expiresAt`, id del incoming payment, el access token de ese incoming payment, `authServer` del comprador, los dos montos y el id del pedido. Si el comprador no aprueba, `incomingPayment.complete` con ese token cierra el cobro para que deje de aceptar dinero.
8. Responde al front con `payment`, `debitAmount` y `redirectUrl` (`interact.redirect`). La pantalla que ya existe muestra Monto (`amount`), Desde tu wallet (`debitAmount`) y un botón. Ese botón abre `redirectUrl`. Trae `clientUri`. No la cortes en el `&`.

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
