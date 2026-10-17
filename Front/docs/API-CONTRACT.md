# Integración de Lokora con Axiom API

El contrato recibido está conservado en [api/axiom-frontend-context.md](api/axiom-frontend-context.md). Es documentación de referencia del backend. La implementación mantiene la identidad y pantallas de Lokora.

## Configuración

La app tiene activo el modo API en `.env.local`, y el cliente usa `api` como valor por defecto. La configuración es `VITE_DATA_SOURCE=api` y `VITE_API_BASE_URL=https://interledger-axiom-hackathon-production.up.railway.app/api/v1` en el entorno del frontend. `.env.example` contiene la configuración sin credenciales. Para utilizar la demo local, definir `VITE_DATA_SOURCE=mock`. Reiniciar Vite al cambiar las variables.

El frontend local corre en `http://127.0.0.1:3000`; el backend debe permitir ese origen en `CORS_ORIGIN`. Si el backend corre localmente, usar otro puerto para evitar el conflicto con el frontend. Las imágenes `/uploads/...` se resuelven contra el host de la API, sin el prefijo `/api/v1`.

Se confirmó el login con la cuenta demo de comprador a través del proxy Node y la carga de Alba Casco y Luna Centro desde la API. Las contraseñas no se almacenan. El registro y el envío de OTP no se han ejecutado durante esta reparación.

## Autenticación y roles

- Solo bienvenida, login y registro son públicos en la app. Se espera a recuperar la sesión antes de mostrar contenido privado. Esto mantiene el login obligatorio solicitado, aunque el backend exponga públicamente el catálogo.
- El login permite contraseña o código OTP por correo, sin pedir el rol. Como el contrato no ofrece una ruta unificada, intenta la ruta del rol de la sesión previa (buyer por defecto) y únicamente ante HTTP 403 con código `WRONG_ROLE` utiliza la ruta del otro rol. El acceso OTP usa las mismas reglas con `/sign-in/otp`. No reintenta ante credenciales inválidas, errores de red ni rate limit. El rol que devuelve la API determina el destino y los permisos; no se infiere por el correo. El registro mantiene la elección buyer/seller y utiliza la ruta correspondiente. No se manda un rol manipulable en el body.
- Bearer token opaco y rol en memoria y `sessionStorage`, separados del mock. Tras login y registro se consulta `/me` antes de abrir la app. `/me` también restaura al usuario; `/auth/sign-out` revoca la sesión. Un 401 de una llamada protegida borra token y rol y devuelve al inicio. Las contraseñas no se guardan.
- El frontend compara IDs normalizados a string, evitando mezclar IDs numéricos con IDs de auth recibidos como texto.
- Buyer y seller son cuentas separadas. El mock también respeta esta división. El comprador ve carrito/compras; el vendedor ve su negocio. Los enlaces directos se protegen según rol. El backend sigue siendo la autoridad de permisos.
- El registro de vendedor envía organización y sucursal en una sola petición, con identificación legal, país, dirección, coordenadas y moneda. No se usa un supuesto `POST /stores`.

## Catálogo y mapa

El contrato compartido inicialmente no incluía un directorio de tiendas. El frontend ahora toma `GET /stores` como fuente del directorio, según la respuesta de ejemplo recibida el 16 de octubre de 2026 (`{stores, nextCursor}`). Pagina el listado, conserva las sucursales `active`, y enriquece las tarjetas con los productos obtenidos de `GET /items`. De este modo también puede representar tiendas sin productos. El vendedor obtiene su propia sucursal mediante `GET /seller/store`.

El detalle consulta tienda, categorías y productos filtrados por `storeId`. Se respeta `nextCursor` hasta terminar, con detección de cursor repetido.

La respuesta pública de tienda incluye `bannerUrl` (portada) e `iconUrl` (logo). El frontend los asigna a `cover` y `logo`; las rutas relativas `/uploads/...` se resuelven contra el host de Axiom. Si falta la URL o falla su carga, se usa el recurso visual genérico. La estructura compartida no incluye puntuación, distancia ni categoría global; no se inventan esos datos. El precio visible es `finalPriceAmount`, convertido desde unidades menores con la escala de su moneda. Por ejemplo, 255 USD en el transporte se muestra como US$2,55; no se convierte a COP. El precio de lista queda en `originalPrice`.

## Puntaje e impacto del marketplace

Según la especificación compartida el 2026-10-16, la pantalla de Impacto consume `GET /stats` (público, panorama y `topStores`, con `limit`/`city` opcionales) y `GET /stores/:id/stats` (público, puntaje individual). La respuesta de tienda contiene `score` 0–100, `stars`, `level`, `confidence`, `breakdown` (`catalog`, `sales`, `reliability`, `activity`) y contadores de actividad. El frontend consulta puntajes de tiendas del directorio, ordena por `score`, y presenta el desglose y métricas sin saldo ni importes de venta.

La única respuesta de estadísticas completa compartida como ejemplo hasta ahora es la de `/stores/:id/stats`. El mapeo del panorama agregado desde `/stats` solo muestra contadores escalares que reconozca; si la respuesta real usa otra forma, mantiene la vista de puntajes y deja los contadores como no disponibles. Falta cotejar un ejemplo JSON de `/stats` y `/seller/stats`. Al consultar el servidor de producción el 2026-10-16, `GET /api/v1/stats` y `GET /api/v1/stores/4/stats` devolvieron `NOT_FOUND`; la conexión está implementada en el frontend pero ese despliegue aún no entrega los datos. El endpoint privado `/seller/stats` no se usa en el impacto del comprador.

Los productos agotados no pueden añadirse al carrito. Las coordenadas vienen de `latitude`/`longitude`, sin reemplazarlas por ubicaciones ficticias en Medellín. La disponibilidad de Google Maps depende de su clave; sin ella continúa el proveedor alternativo.

## Carrito, pedido y pago

En modo API:

1. Carrito remoto: `GET /cart`, `PUT /cart/items/:itemId`, `DELETE /cart/items/:itemId` y `DELETE /cart`. La cantidad enviada reemplaza a la anterior. Las mutaciones se serializan para evitar perder clics sucesivos.
2. Un carrito pertenece a una sola sucursal. La interfaz bloquea añadir productos de otra tienda tanto en modo API como mock y abre el carrito actual con una explicación. La validación local del modo API se ejecuta dentro de la cola de mutaciones para cubrir clics rápidos entre tiendas. El servidor mantiene su validación `CART_OTHER_STORE`. La persona debe finalizar la compra o pulsar «Vaciar carrito» para cambiar de comercio; no se eliminan ni sustituyen productos automáticamente. Cantidades, precios y disponibilidad se vuelven a leer del servidor. No se mantienen carritos independientes simultáneos por tienda.
3. `POST /orders` reserva stock. La clave de idempotencia se genera por intento y se conserva para reintentos; el backend define precios, descuentos, comisión y vencimiento.
4. `POST /orders/:id/pay` usa otra clave persistente del intento. No se considera éxito la mera respuesta a `/pay`. La respuesta trae `{payment,checkout,created}`; el checkout contiene redirectUrl, expiresAt y los importes receive/debit/fee. El comprador revisa la cotización y abre la autorización en otra pestaña. Se consultan el pedido y sus pagos cada cuatro segundos hasta confirmar `captured` y un estado de pedido pagado o posterior. La consulta se detiene al salir de la pantalla; el pedido activo y sus claves pueden recuperarse dentro de la sesión del navegador.
5. El estado `paid` (o posterior: `preparing`/`completed`) permite mostrar confirmación. Cancelaciones y reembolsos no se presentan como pagos exitosos. Un 401 termina el acceso.
6. Las compras se obtienen de `/orders` y se muestran en su moneda real. La API actual no informa el débito en otra moneda, ni el saldo externo del comprador.

El flujo actualizado usa **Open Payments** mediante `POST /orders/:id/pay` con `{}` para la wallet principal del comprador. No utiliza `/payment-quotes`, `/me/payment-wallet` ni un `/payments` global. El ejemplo remoto confirmado contiene débito en EUR y recepción en COP. La autorización y el callback son gestionados por el proveedor y el backend. La app no consulta saldos, no inventa tasas y no acepta un redirect como prueba de captura.

## Open Payments y funciones pendientes

La simulación local conserva su ejemplo USD → COP. En modo API la cotización y la autorización vienen del backend; puede debitar EUR u otra moneda de la wallet principal. No se asignan fondos al registrar una cuenta y no se muestra un saldo inexistente. Mis wallets consulta GET /me/wallets y agrega direcciones mediante POST /me/wallets; las rutas para cambiar la principal y eliminar están pendientes de confirmar.

El catálogo recibido tiene moneda USD. Para que una tienda cobre COP debe existir una sucursal configurada en COP; la moneda es inmutable según el contrato. El frontend no puede cambiarla mediante formateo.

El panel de vendedor de modo API consulta productos y pedidos de su sucursal. El panel incluye fotos y acceso a `sellerProduct/:id`: consulta privada del producto y categorías, edición de nombre, SKU, descripción, precio de lista, categoría y estado mediante PATCH, más carga separada de imágenes (JPG/PNG/WebP, máximo 5 MB y 8 imágenes). La moneda no se modifica; el precio se convierte de forma exacta desde el texto a unidades menores. El stock se muestra sin editar y requiere sus operaciones de inventario. La ruta `createStore` en modo API ahora consulta `GET /seller/store` y presenta «Editar mi tienda» con precarga de nombre, descripción, dirección, ciudad, teléfono, coordenadas y estado; guarda únicamente los campos modificados mediante `PATCH /seller/store`. La moneda se conserva y las imágenes actuales se precargan con `iconUrl`/`bannerUrl`. El probador público `/demo.js` lista `DELETE /seller/store/icon` y `DELETE /seller/store/banner`. La interfaz permite sustituir o quitar cada imagen; configura PUT en esas mismas rutas con FormData y campo `image`, siguiendo el método indicado por el usuario y la convención de carga de productos. El documento actualizado recibido posteriormente confirma PUT con campo `image` y máximo 5 MB (banner 1600×600; icono circular 256×256). La carga autenticada todavía no se ha ejecutado durante la implementación. No se han subido ni eliminado imágenes reales durante esta implementación. En mock, el formulario crea o edita la tienda propia con persistencia en sessionStorage. Siguen pendientes organización, alta/baja de productos y gestión operativa de pedidos. Pagos programados permanece sin integración. La cuponera ya consume datos reales de comprador y aplica sus descuentos al carrito. Impacto ya tiene vistas preparadas para estadísticas públicas, con estados de datos no disponibles y ejemplo explícito. Las estadísticas privadas del vendedor todavía requieren un ejemplo de respuesta para completar su interfaz.

## Errores y transporte

Se aceptan `{ error: { message, code } }` y `{ message, code }`. `ApiError` conserva `status` y `code`; los flujos usan códigos o estados, nunca coincidencias del mensaje. Se manejan respuestas 204 sin intentar parsear JSON. Las subidas usan `FormData` con campo `image`, sin forzar Content-Type. El servidor sigue siendo responsable de límites, stock, permisos, idempotencia, cobros y estados.

## Formato de wallet en el prototipo

El registro mock y el paso de conexión de wallet aceptan Payment Pointers (`$host/ruta`) y direcciones HTTPS. El campo es texto para no activar la validación HTML de URL contra el prefijo `$`. Internamente `$host/ruta` se resuelve a `https://host/ruta`; un pointer sin ruta o con `/` resuelve a `https://host/.well-known/pay`. No se aceptan credenciales, puerto explícito en un pointer, query ni fragmento. Se conserva la ruta y su barra final. La interfaz muestra el identificador con `$` cuando es representable como pointer. Esto valida formato, no la compatibilidad o propiedad de una wallet. La sección Mis wallets envía las direcciones a POST /me/wallets con {name, address} y muestra GET /me/wallets; ver docs/WALLETS.md.

Referencia: https://paymentpointers.org/syntax/.

## Autenticación aplicada desde el diagrama

- `POST /auth/buyer/sign-up`: email, contraseña y nombre. `POST /auth/seller/sign-up`: los mismos datos más organización y sucursal.
- Contraseña: `POST /auth/{rol}/sign-in`. OTP: envío explícito con `POST /auth/email-otp/send-verification-otp` y `type: sign-in`, seguido de `POST /auth/{rol}/sign-in/otp` con email y seis dígitos.
- La solicitud de OTP solo ocurre al pulsar el botón. No hay envíos automáticos al montar pantallas. El frontend limita el reenvío y respeta `Retry-After` numérico; el servidor controla caducidad, intentos y rate limits.
- Después del registro se entra directamente al espacio del rol, sin mostrar un paso de verificación. La verificación de correo permanece opcional en el perfil: se solicita un código con `type: email-verification` y se confirma con `POST /auth/email-otp/verify-email`. Tras verificar, `/me` actualiza `emailVerified`. No se cambia la configuración de envío automático de correos del backend.
- Las respuestas exitosas de auth se confirman con `/me`. El rol del perfil decide comprador o vendedor. Si la cuenta se creó pero `/me` falla por red, la interfaz informa que la cuenta ya existe y pide iniciar sesión, evitando afirmar que falló su creación.
- La consulta pública `/health` respondió `status: ok`. No se han creado cuentas ni enviado códigos OTP durante la integración. Se confirmó una sesión de comprador y la carga del catálogo con el proxy; queda pendiente un registro y OTP completos.

## Proxy local a Axiom

El navegador realiza solicitudes al mismo origen que la app. `server.js` reenvía únicamente `/api/v1/*` a `AXIOM_API_ORIGIN` por HTTP(S), sin seguir redirecciones ni registrar cuerpos o cabeceras de autenticación. Reenvía `Authorization`, Content-Type, Idempotency-Key, Accept y Retry-After según el contrato. Las subidas se transmiten en streaming. El backend sí debe estar disponible para Node; la política CORS del navegador no interviene en esta ruta same-origin. El proxy devuelve un 502 estructurado si Axiom no responde.

## Resumen visual y acción de pago

La vista de compra muestra los productos con miniatura, cantidad e importe antes de crear el pedido. El botón «Pagar» crea el pedido, consulta su detalle con precios congelados y solicita el pago en una sola acción; conserva las claves de idempotencia y espera `captured` en `GET /orders/:id/payments` y estado pagado del pedido. Si el total cambia respecto del carrito, muestra el nuevo importe y requiere pulsar Pagar nuevamente. La reserva de stock continúa siendo una operación interna del backend. La interfaz indica que el pago se autoriza en el proveedor de wallet; no presenta el flujo de API como un placeholder sin cobro.

Las miniaturas del carrito y del resumen se resuelven desde el catálogo cargado. Si no está disponible el producto en memoria, se consulta `GET /items/:id` sin modificar precios del pedido. Ante imágenes vacías o fallidas se usa un recurso SVG genérico de producto; no se inventa una fotografía del producto real.

## Cuponera y total del carrito

Contrato actualizado completo: [api/axiom-updates-2026-10-16.txt](api/axiom-updates-2026-10-16.txt).

La ruta `coupons` ya está habilitada en modo API. `GET /coupons` se pagina hasta `nextCursor:null`; cada registro contiene `store`, `inWallet`, `source`, `state` e `itemIds`, además de las condiciones. Se confirmó el formato mediante una consulta de lectura con la cuenta demo del comprador. Los filtros de guardados, disponibles y tienda se aplican sobre la lista cargada.

La tarjeta completa permite seleccionar el cupón. Si hay productos de esa tienda en el carrito, un solo toque guarda primero el cupón público cuando corresponda (`POST /coupons/:id/claim`) y lo aplica (`PUT /cart/coupon` con `couponId`). No exige dos toques ni un código. Sin productos, conduce a la tienda. Si hay productos de otro comercio, muestra el carrito existente y no lo vacía ni mezcla tiendas. Los cupones usados, agotados, vencidos, próximos o pausados no se pueden seleccionar. No se ofrece retirar de la cartera porque no se recibió un endpoint para hacerlo.

En el carrito, «Elegir cupón» es la acción principal y abre la cuponera filtrada por su tienda. «Tengo un código» revela opcionalmente el campo (`PUT /cart/coupon` con `code`). Se puede cambiar o quitar el cupón (`DELETE /cart/coupon`). Presenta `couponDiscountAmount` y el `totalAmount` autoritativo del servidor. Los precios de líneas conservan los descuentos de producto y no se usan para recalcular el total con cupón en frontend. Un `couponError` se muestra por código y bloquea el paso al pago hasta resolverlo o quitarlo. Se maneja total cero si el descuento cubre la compra completa.

Checkout conserva el cupón del carrito en `POST /orders`; presenta el descuento congelado del pedido con `couponId`, `couponCode` y `couponDiscountAmount`. No se inventan descuentos ni se acumulan cupones. Las operaciones de cupón se serializan con las mutaciones de cantidades. Se mantienen validaciones de servidor para mínimos, topes, productos aplicables, vigencia y límites de uso.

El 401 en `/seller/coupons/:id/redemptions` requiere un token de vendedor, no uno de comprador. El panel y perfil del vendedor incluyen «Cupones de mi tienda»: listado, alta, edición de campos permitidos después del uso (título, descripción, estado, vencimiento y usos totales), eliminación con confirmación y asignación por correos. El alta admite porcentaje en puntos base o monto fijo en unidades menores, código, mínimos, tope, fechas, usos, audiencia y productos de la sucursal. Los resultados de asignación distinguen asignados, existentes y no encontrados. El historial de redenciones queda preparado en el servicio, sin pantalla dedicada. No se crearon, reclamaron ni canjearon cupones reales durante la implementación; solo se consultaron cupones y carrito existentes.

## Validación de autorización con Open Payments

Se validó el 2026-10-16 el catálogo público de la tienda 4 y la preparación de un pedido para el producto 13 (una unidad), usando el token de prueba recibido solo en memoria del proceso. No se incorpora ese token al código ni a la documentación. El carrito estaba vacío antes de la validación. Se crearon claves de idempotencia únicas; `POST /orders` fue sin body y `POST /orders/:id/pay` llevó `{}`.

La respuesta confirmó `checkout.receive={value:"85000000",assetCode:"COP",assetScale:2}`, `checkout.debit={value:"24029",assetCode:"EUR",assetScale:2}`, `fee:null`, `expiresAt` y una autorización en `https://auth.interledger-test.dev`. Equivale a 850.000 COP recibidos y 240,29 EUR debitados. Los importes de checkout se decodifican por **assetScale explícita**, sin asumir que coincide con los decimales que Intl asigna a esa moneda. El total de recepción debe coincidir con el importe del pedido antes de mostrar la autorización.

El pago quedó `pending` porque no se abrió ni aprobó el grant. El pedido de validación (id 4) se canceló después para liberar la reserva. Por tanto se validaron preparación/cotización/cancelación, pero no una captura aprobada de principio a fin. La wallet debe ser aprobada por su usuario.

Las claves de intento, el id de pedido y el id de pago se conservan en sessionStorage. El redirectUrl de autorización permanece solo en memoria. Tras recargar se recupera el enlace usando la misma clave de pago; un enlace expirado permite iniciar una autorización nueva con otra clave. El éxito exige `captured` y pedido `paid`, `preparing` o `completed`. Cancelación, reembolso y fallo no se muestran como pagos exitosos. Hay comprobación manual adicional.
