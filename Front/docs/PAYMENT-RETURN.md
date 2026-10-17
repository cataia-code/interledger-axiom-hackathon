# Regreso a Lokora tras autorizar Open Payments

## Flujo actual sin modificar el backend

La autorización abre una ventana nueva desde el clic del comprador y la pestaña original de Lokora permanece abierta. La aplicación guarda la referencia de esa ventana, elimina su opener antes de cargar el proveedor y consulta el pedido y sus pagos cada cuatro segundos. No intenta leer el HTML, JSON ni URL de la ventana externa.

Después de comprobar un pago captured y un pedido confirmado, intenta cerrar la ventana y enfocar Lokora; también la cierra si la API confirma rechazo, fallo, cancelación o reembolso. Se vuelve a consultar inmediatamente cuando el usuario regresa a la pestaña. El botón Pagar permanece bloqueado mientras se espera, sin iniciar nuevos intentos por el mero cierre de la ventana.

El navegador puede abrir una pestaña en lugar de popup, bloquear ventanas, impedir el enfoque o separar la referencia por políticas del proveedor. Si el popup falla, el enlace normal abre otra pestaña con noopener. En esos casos puede ser necesario volver/cerrar manualmente. El JSON del callback podría ser visible unos segundos hasta que la consulta confirme el resultado; no podemos cambiar su contenido sin modificar el backend.

Este flujo funciona con el callback JSON actual y no requiere redirección nueva del servidor. La sección siguiente conserva la alternativa de redirección para una integración futura; la ruta paymentReturn ya está preparada.


## Alternativa preparada: retorno en la misma pestaña

- Preloader al recuperar el pedido, preparar el pago, pedir cotización y comprobar confirmación.
- Botón Pagar deshabilitado durante solicitudes y mientras se espera confirmación; bloqueo inmediato mediante ref contra dobles clics.
- Autorización en la misma pestaña para conservar sessionStorage y la sesión durante el recorrido por el proveedor.
- Ruta `/#paymentReturn/:orderId`, protegida por inicio de sesión de comprador. No toma un parámetro de éxito como prueba de pago.
- La ruta consulta GET `/orders/:id` y GET `/orders/:id/payments`. Solo presenta éxito si hay `captured` y el pedido está pagado/en preparación/completado. Rechazados, cancelados y errores se muestran sin iniciar otro débito.
- Si el proveedor tarda, consulta cada cuatro segundos hasta dos minutos; después permite verificar otra vez.

## Cambio necesario en el backend desplegado

La URL de retorno de Railway actualmente responde JSON, como `{status:"denied",orderId:9}`. Un frontend alojado en otro origen no puede reemplazar esa respuesta ni redirigir esa página por su cuenta.

Después de verificar el callback Open Payments y guardar su resultado (tanto autorizado como denegado), la ruta de retorno del backend debe responder HTTP **303** hacia:

`<FRONTEND_APP_URL>/#paymentReturn/9`

Por ejemplo, en desarrollo en este computador: `http://localhost:3000/#paymentReturn/9`. Para probar desde otro dispositivo se necesita el dominio real donde esté alojado Lokora; localhost en otro teléfono apunta a ese teléfono.

Se incluye un helper listo para integrar en `docs/backend/payment-return-redirect.mjs`. No es parte del servidor frontend ni se ha desplegado en Railway. Configurar `FRONTEND_APP_URL` en el backend con una dirección fija y confiable. Invocar el helper tras persistir el resultado del callback, en lugar de la respuesta JSON destinada al navegador. No sustituir los pasos de verificación/captura del proveedor. Si hay consumidores JSON de esa misma ruta, conservar un modo explícito para ellos según el contrato del backend.

No enviar Bearer, grant ni claves en la URL de regreso. El orderId solo identifica qué recurso debe consultar el comprador autenticado. La API debe mantener sus controles de propiedad del pedido. No enviar returnUrl en POST /orders/:id/pay hasta que ese campo esté documentado.

## Limitaciones pendientes

El helper necesita integrarse y desplegarse en el repositorio backend, que no está disponible en este workspace. En el flujo de ventana separada, la consulta desde la app original permite continuar aunque el proveedor termine en JSON de Railway. La nueva ruta puede manejar el regreso una vez que el backend redirija. Un retorno a una aplicación Android nativa requerirá posteriormente configurar App Links o un esquema de deep link verificado.

## Cierre y señal de aceptación

Al detectar captured por API, la aplicación intenta cerrar la ventana una sola vez, incluso si el pedido todavía está conciliándose. Mientras espera el estado final del pedido muestra Tu wallet confirmó el pago. Estamos actualizando el pedido. Al confirmarse ambas condiciones, muestra Autorización aceptada y pago confirmado. Si el navegador impide cerrar/enfocar, se ofrece la indicación de cerrar manualmente; no se garantiza un cierre universal desde JavaScript.

checkout.redirectUrl es el destino para autorizar el débito, no necesariamente una URL de regreso a Lokora. Un nuevo campo de retorno requiere un ejemplo del contrato para integrarlo; no se sustituye la URL del grant ni se interpreta un redirect como captura.

## Detectar el callback JSON actual del backend

El bundle reconoce `/?payment=<resultado>&order=<id>` antes de montar la pantalla Welcome. Trata `payment` solamente como un evento de retorno, jamás como prueba de captura. Publica el orderId por BroadcastChannel al opener; el app original lo acepta únicamente si coincide con el intento guardado de la sesión o con la compra recién confirmada. Envía ACK con nonce, reconsulta la API y enfoca Lokora.

La ventana de callback verifica un marcador por orderId que se guardó al crear el popup. Si es la ventana de autorización, intenta cerrarla tras ACK. Si se pierde el contexto del popup, el mismo-tab callback cambia a la ruta autenticada `#paymentReturn/:id`; la app vuelve a comprobar GET order + payments y solo confirma captured. Ningún estado del query ni nonce significa pago exitoso.

## Contador visual de regreso

La pantalla de retorno de Lokora muestra un contador circular de hasta tres segundos, con arco de progreso, marca, mensaje y controles de cierre manual si el navegador lo impide. El plazo usa tiempo real transcurrido, no una cifra decorativa. Si llega ACK de la pestaña original, el cierre se intenta inmediatamente sin esperar a completar el contador. Esto no es el vencimiento de la cotización ni una confirmación de débito. No presupone cambios no documentados en el backend.
