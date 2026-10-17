# Mis wallets

Acceso de compradores: Perfil → Mis wallets (`#wallets`). El checkout también enlaza a `#wallets/payment` y permite volver al pago pendiente.

La sección permite listar y agregar wallets por cuenta. No consulta ni muestra saldos. Admite direcciones HTTPS y Payment Pointers, que se normalizan a HTTPS antes de enviar a la API.

## Persistencia en la API

- `GET /api/v1/me/wallets` requiere el Bearer de la sesión y devuelve `{wallets: [...]}`.
- Cada wallet contiene `id`, `name`, `address`, `assetCode`, `assetScale`, `isPrimary` y `updatedAt`.
- El formulario envía `POST /api/v1/me/wallets` con `{name, address}` y vuelve a consultar la lista después de guardar. Se bloquean envíos simultáneos.
- La API es la fuente de verdad para la moneda y la wallet principal. La tarjeta muestra `isPrimary` como Principal.
- El pago continúa enviando `{}` a `POST /orders/:id/pay`, usando la principal del backend.
- Ante un fallo de API se muestra el error con una opción de recarga. No se sustituye la lista por datos locales ni se presenta un fallo como una cuenta sin wallets.
- Las direcciones del antiguo directorio local no se migran automáticamente.

Se confirmó la respuesta GET con la cuenta demo (wallet EUR principal). Un POST vacío devolvió `400 INVALID_WALLET_ADDRESS`, sin crear wallets. No se registraron direcciones reales durante la implementación.

Las rutas y cuerpos para eliminar y cambiar la principal aún no están confirmados. Esos controles no se muestran en modo API. El modo mock conserva la gestión local de preferidas y eliminación.

La implementación separa persistencia, tarjeta y página en `savedWalletService`, `SavedWalletCard` y `AssociatedWalletsPage`.

## Autorización externa del pago

La muestra `endpointsTest.json` confirma `checkout.redirectUrl`, `buyerWallet`, `expiresAt`, `receive`, `debit` y `fee`. El archivo recibido contiene texto con varias respuestas, no un único documento JSON. No se copia su URL de autorización al código.

Después de revisar la cotización, el enlace Autorizar en mi wallet abre `checkout.redirectUrl` en una ventana aislada del proveedor. Hay una alternativa en otra pestaña para navegadores que bloqueen ventanas emergentes. La aprobación del débito corresponde al usuario en el proveedor. Abrir o cerrar la ventana no confirma el pago: el checkout consulta la API y exige un pago `captured` y un pedido confirmado. La dirección `buyerWallet` se muestra como referencia de la wallet utilizada por el backend.

## Registro de vendedor

El registro API exige `storeWalletAddress` y la moneda de la sucursal (COP o USD, las opciones ya ofrecidas por el registro). Valida el formato de la dirección antes de crear la cuenta. La moneda se envía como `store.currency` en sign-up; después de autenticarse se envía `{name, address}` a POST /me/wallets. No se envían propiedades de wallet no documentadas al registro ni se fuerza `assetCode`: la API devuelve la moneda real de la wallet.

El usuario termina en Mis wallets para revisar el resultado, incluyendo una advertencia si la principal tiene una moneda distinta de la tienda. Si falla la asociación, la cuenta y tienda ya creadas no se registran otra vez. Los vendedores acceden a Mis wallets desde Perfil y Editar mi tienda.

Importante: GET /me/wallets es por cuenta, y no confirma por sí solo la asociación receptora a una tienda. Esa relación y la ruta de configuración específica de tienda aún deben confirmarse con el backend. No se presenta la tienda como lista para recibir dinero solamente por haber guardado una wallet del vendedor.

## Wallets receptoras expuestas por store

El nuevo GET /stores y GET /stores/:id devuelve `store.wallets`, con `id`, `name`, `address`, `assetCode`, `assetScale`, `isPrimary`. Se confirmó en el detalle público: Mercado Campesino (6) no tiene wallets y Panadería El Poblado (4) tiene una wallet principal COP. La wallet del comprador en /me/wallets es independiente.

El checkout consulta el detalle actual de la tienda, muestra su configuración receptora y bloquea la preparación de un pago si no hay una wallet principal con dirección y moneda coincidente. Antes de crear un pedido o una autorización vuelve a leer la tienda para no reservar stock basándose en una configuración antigua. Se permite volver a verificar si el vendedor agrega una wallet. Una respuesta ausente o inválida genera un error de verificación, no se interpreta como una lista vacía.

Editar mi tienda y Mis wallets del vendedor también muestran la configuración receptora obtenida de store, separada de las wallets de cuenta. El despliegue de lectura no confirma aún las rutas ni el cuerpo de escritura para asociar una wallet a store; no se inventa un POST/PATCH de wallets de tienda. El registro existente sigue guardando la dirección en /me/wallets como wallet de cuenta; esa operación no establece recepción de tienda. Falta conectar el registro al contrato de escritura de store cuando se publique.

La verificación de recepción usa ahora GET /stores (incluyendo paginación), localiza la tienda por id y consulta su arreglo wallets. Si existe una principal con otra moneda, la vista muestra esa wallet y la diferencia de monedas en lugar de afirmar que no hay wallet. Se mantiene el requisito actual de recepción en la moneda de la tienda.

## Recepción en otra moneda

Se eliminó la restricción frontend de igualdad entre store.currency y wallet.assetCode. La presencia de la principal permite solicitar el pago; el backend decide si puede realizar la conversión. Una moneda distinta se muestra como información, sin bloquear el botón. La app exige que payment.orderId, payment.amount y payment.currency coincidan con el pedido congelado; si receive está en la misma moneda también compara su importe. Si está en otra, muestra los importes de la cotización de API sin inventar una tasa. La confirmación sigue requiriendo captured y pedido confirmado. Esta nota reemplaza el requisito anterior de igualdad de monedas para habilitar el pago.

## Contrato de conversión y comisión confirmado

La conversión es responsabilidad del backend/Open Payments. La interfaz no exige igualdad de monedas entre pedido, comprador y receptor; tampoco calcula tasas ni compara receive con el importe del pedido usando la escala por defecto de la moneda. Mantiene la validación del importe/moneda de payment contra el pedido, y verifica orderId si viene incluido (la muestra más reciente no lo incluye).

Los importes de checkout se muestran aplicando sus propios assetScale. fee null se presenta como Sin desglose separado, no como Sin comisión. No se restan importes en EUR y COP para inventar una comisión. Se retiraron también los mensajes de registro y wallets que exigían igualdad de moneda.

## Historial de compras y estados

Mis compras está disponible para compradores en el menú superior, con icono de bolsa y etiqueta Compras. El historial incluye todos los pedidos de GET /orders, no solamente los pagados. Para pending_payment consulta GET /orders/:id/payments con concurrencia máxima de tres solicitudes para mostrar el último intento.

Las tarjetas distinguen pagado/en preparación/completado, pendiente, pago no completado, cancelado, reembolsado y plazo vencido. Un pedido pendiente no se presenta como error sin evidencia de un intento fallido. El vencimiento se calcula usando expiresAt devuelto por el servidor y se vuelve a evaluar al actualizar/renderizar. Si falla la consulta del último intento, se informa sin inventar un resultado. Si falla el historial completo, se muestra el error y los datos anteriores como potencialmente desactualizados.

Hay filtros por estado y actualización manual; entrar a la vista vuelve a consultar el historial. Las tarjetas no duplican un importe como supuesto cargo: solo muestran un débito aparte si se conoce su importe y moneda y difiere del total mostrado. No se inicia ni reintenta un cobro desde el historial.

## Presentación compacta del historial

Mis compras usa filas agrupadas en una sola lista con separadores. Cada fila muestra logo, comercio, fecha corta, importe y estado. Los pagos confirmados tienen importe verde y etiqueta verde con texto blanco; cancelados y fallidos mantienen etiqueta roja. Los detalles (referencia, descripción, fecha completa y débito conocido) se despliegan con un elemento details/summary accesible mediante teclado. El importe se formatea una sola vez con Intl, sin repetir COP junto al formato que ya lo contiene.

Se retiró el banner del historial para ahorrar altura. El acceso superior usa un icono propio de comprobante (receipt), distinto del ticket de cupones. El estilo compacto está separado en components/payments/purchases.css.

## Indicador de pago y retorno del proveedor

Ver docs/PAYMENT-RETURN.md. La autorización ahora usa la misma pestaña y existe /#paymentReturn/:orderId para revalidar el pago autenticado. Los textos anteriores que describían una ventana emergente corresponden a la implementación anterior. La redirección desde el callback de Railway requiere integrar el helper en el backend: el frontend no transforma la respuesta JSON de otro servidor.

## Alternativa sin despliegue backend

La autorización vuelve a usar una ventana separada. La app original consulta el pago y cierra/enfoca la ventana, cuando el navegador lo permite, tras confirmar el resultado por API. No es necesario modificar el callback JSON para este flujo. La redirección same-tab queda como alternativa futura documentada en PAYMENT-RETURN.md.
