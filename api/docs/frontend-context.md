# Axiom API: contexto para frontend

Marketplace con dos roles: **buyer** (compra) y **seller** (vende). API REST JSON.

- **Base URL (prod):** `https://interledger-axiom-hackathon-production.up.railway.app/api/v1`
- **Base URL (local):** `http://localhost:3000/api/v1`
- **Probador interactivo:** `<host>/demo.html`
- **Imágenes:** se sirven en `<host>/uploads/...` (el campo `url` de una imagen es relativo al host, no a `/api/v1`).
- **CORS:** solo los orígenes listados en `CORS_ORIGIN` en el servidor. Si tu frontend corre en otro dominio/puerto, hay que añadirlo ahí.

## Convenciones

| Tema | Regla |
|---|---|
| Formato | `Content-Type: application/json` (excepto subida de imágenes) |
| Auth | `Authorization: Bearer <token>`. El token lo devuelven sign-up y sign-in. Es opaco y revocable (no es JWT, no hay refresh) |
| Dinero | **Enteros en unidades menores** (centavos). Nunca decimales. La moneda (`currency`, ISO 4217) es la de la sucursal |
| IDs | Numéricos. Las respuestas de auth pueden traerlos como string; convierte con `Number()` si comparas |
| Paginación | Por cursor: `?limit=&cursor=` → respuesta con `nextCursor` (`null` = no hay más). Pasa `nextCursor` como `cursor` |
| Idempotencia | `POST /orders` y `POST /orders/:id/pay` exigen header `Idempotency-Key` (8-80 chars: letras, dígitos, `_ . : -`). Genera un UUID por intento; reusarlo devuelve el mismo resultado (200 en vez de 201) |
| Rate limit | 429 al excederse. Auth por rol: 5/min por ruta. Resto: 600/min lecturas, 120/min escrituras, 10/min en `POST /orders` y `/pay` |

### Formato de error

Rutas propias y de rol:

```json
{ "error": { "message": "…", "code": "SOME_CODE" } }
```

Rutas genéricas de Better Auth (`/auth/email-otp/*`, `/auth/sign-out`): `{ "message": "…", "code": "…" }` (sin envoltorio `error`). El frontend debe aceptar ambos. **Usa `code` para lógica, no `message`.**

| HTTP | Significado | Códigos típicos |
|---|---|---|
| 400 | Datos inválidos | `INVALID_*`, `CART_EMPTY`, `IDEMPOTENCY_KEY_REQUIRED`, `INVALID_OTP`, `EMPTY_UPDATE`, `CATEGORY_CYCLE` |
| 401 | Sin sesión / credenciales malas | `UNAUTHORIZED`, `INVALID_EMAIL_OR_PASSWORD` |
| 403 | Rol incorrecto | `FORBIDDEN`, `WRONG_ROLE`, `STORE_REQUIRED`, `ORGANIZATION_REQUIRED` |
| 404 | No existe / ajeno | `NOT_FOUND`, `ORDER_NOT_FOUND` |
| 409 | Conflicto de estado | `INSUFFICIENT_STOCK`, `CART_OTHER_STORE`, `ITEM_UNAVAILABLE`, `INVALID_TRANSITION`, `ORDER_NOT_PAYABLE`, `SKU_ALREADY_EXISTS`, `DISCOUNT_OVERLAP`, `CATEGORY_SLUG_EXISTS`, `REFUND_EXCEEDS_PAYMENT`, `USE_CANCEL`, `TAX_ID_ALREADY_EXISTS`, `LEGAL_ID_ALREADY_EXISTS`, y los de cupones (`COUPON_*`, ver la sección Cupones) |
| 413 | Imagen > 5 MB | `IMAGE_TOO_LARGE` |
| 422 | Correo ya registrado | `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` |
| 429 | Rate limit | `RATE_LIMITED` |
| 500 | Error interno | `INTERNAL_ERROR` |

## Autenticación

Cada rol tiene sus propias rutas. Un login solo acepta cuentas de su rol (si no, 403 `WRONG_ROLE`). No se puede enviar el rol desde el cliente: lo fija la ruta de registro.

Respuesta de sign-up/sign-in: `{ "token": "…", "user": { "id", "email", "name", "role", "emailVerified", "country", "countryName" } }` (el seller además recibe `organization` y `store` en el sign-up). **Guarda el token y envíalo en cada petición protegida.**

| Método | Ruta | Body | Notas |
|---|---|---|---|
| POST | `/auth/buyer/sign-up` | `{email, password(≥8), name, country?}` | 201. Envía código de verificación al correo (verificar es opcional) |
| POST | `/auth/seller/sign-up` | ver abajo | 201. Crea usuario + organización + sucursal en un paso |
| POST | `/auth/buyer/sign-in` · `/auth/seller/sign-in` | `{email, password}` | 200 |
| POST | `/auth/buyer/sign-in/otp` · `/auth/seller/sign-in/otp` | `{email, otp}` | Login con código de 6 dígitos. No crea cuentas |
| POST | `/auth/email-otp/send-verification-otp` | `{email, type}` | `type`: `sign-in` \| `email-verification` \| `forget-password`. 3/min |
| POST | `/auth/email-otp/verify-email` | `{email, otp}` | Marca el correo verificado |
| POST | `/auth/email-otp/request-password-reset` | `{email}` | Envía código |
| POST | `/auth/email-otp/reset-password` | `{email, otp, password}` | Cambia contraseña y revoca sesiones previas |
| POST | `/auth/sign-out` | `{}` + Bearer | Revoca el token |
| GET | `/me` | | `{user:{id,email,name,role,emailVerified,phone,country,countryName}}` |
| PATCH | `/me` | `{name?(1-80), phone?(≤30 \| null), country?(código ISO o nombre \| null)}` | 400 `INVALID_COUNTRY` si no es un código válido |

Códigos OTP: 6 dígitos, caducan en 10 min, 3 intentos. Los códigos nuevos invalidan el anterior.

**País de origen del usuario (`country`):** opcional al registrarse (comprador o vendedor) y editable con `PATCH /me`. Se envía el **código ISO 3166-1 de 2 letras** (`CO`) **o el nombre del país** en español o inglés, sin importar mayúsculas ni tildes (`Colombia`, `panamá`, `Spain`). La API siempre guarda y devuelve el código en `user.country` y el nombre en español en `user.countryName` (`null` y `null` si no se dio). Solo valen los 249 países oficiales; cualquier otro valor responde 400 `INVALID_COUNTRY` y **no crea la cuenta**. En el vendedor es independiente de `organization.country` (país legal de la organización). Para un desplegable usa `GET /countries`.

**Body de `seller/sign-up`:**

```json
{
  "email": "luna@ejemplo.com", "password": "Password-12345", "name": "Luna", "country": "PA",
  "organization": {
    "legalName": "Panadería Luna S.A.", "tradeName": "Luna (opcional)",
    "taxId": "8-123-456", "legalId": "RM-2024-001",
    "country": "PA", "legalAddress": "Calle 50, Ciudad de Panamá", "phone": "opcional"
  },
  "store": {
    "name": "Sucursal Centro", "description": "opcional",
    "address": "Av. Central 123", "city": "Ciudad de Panamá", "phone": "opcional",
    "latitude": 8.98, "longitude": -79.52,
    "legalId": "SUC-001", "currency": "USD"
  }
}
```

Límites: `legalName` 2-120, `taxId`/`legalId` 3-40 (únicos), `country` 2 letras ISO, `legalAddress` 5-200, `store.name` 2-80, `store.address` 5-200, `store.city` 2-80, lat −90…90, lon −180…180, `currency` 3 letras (**inmutable**).

## Catálogo público (sin token)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/stores` | Listado de tiendas **activas** (las pausadas/cerradas no salen), de la más nueva a la más antigua. Filtros: `q` (nombre/descripción), `city`, `limit` (1-50), `cursor`. `sort`: `newest` (por defecto) o `score` (mejor puntaje primero; el `cursor` es un texto opaco, pásalo tal cual). Cada tienda trae `score`, `stars` y `level`. → `{stores:[PublicStore & {score, stars, level}], nextCursor}`. Se puede cachear 60 s |
| GET | `/stores/:id/stats` | Puntaje y contadores de la tienda, sin dinero. → `{stats: StoreStats}` (ver abajo). Cacheable 60 s |
| GET | `/stats` | Panorama del marketplace y ranking. Query opcional: `limit` (1-20, por defecto 5), `city`. → `{stats: {stores:{active,paused}, items:{active}, orders:{total,last30d,byStatus}, users:{buyers,sellers}, topStores:[{id,name,city,iconUrl,score,stars,level}], generatedAt}}`. Cacheable 60 s |
| GET | `/items` | Filtros: `categoryId`, `storeId`, `q` (texto), `sort` (`newest`\|`price_asc`\|`price_desc`), `limit` (1-50), `cursor`. → `{items:[Item], nextCursor}` |
| GET | `/items/:id` | → `{item: Item}` |
| GET | `/stores/:id` | → `{store: PublicStore}`; 404 si está cerrada |
| GET | `/stores/:id/categories` | → `{categories:[Category]}` |

```ts
Item = {
  id, storeId, categoryId, sku, name, description,
  priceAmount,            // precio de lista (centavos)
  currency,
  discount: { id, type: 'percent'|'fixed', value, startsAt, endsAt, active } | null,
  discountAmount,         // descuento unitario aplicado
  finalPriceAmount,       // lo que se paga por unidad → muéstralo como precio
  available,              // stock disponible (no es el stock real)
  images: [{ id, url, width, height, position }],   // url relativa al host
  createdAt
}
PublicStore = { id, name, description, city, address, latitude, longitude, currency, status,
  bannerUrl,   // imagen de portada 1600×600 (WebP) o null
  iconUrl }    // icono circular 256×256 con transparencia (úsalo como pin del mapa) o null
// Las URLs son relativas al host: <host>/uploads/…
Category    = { id, storeId, parentId, name, slug }   // árbol vía parentId
StoreStats  = {
  storeId,
  score,        // 0-100, aproximado (no son reseñas de compradores)
  stars,        // score / 20, un decimal
  level,        // 'new' (menos de 3 pedidos terminados) | 'bronze' <40 | 'silver' 40-64 | 'gold' 65-84 | 'platinum' 85+
  confidence,   // 'low' (<5 pedidos terminados) | 'medium' (5-19) | 'high' (20+)
  breakdown: { catalog /*30*/, sales /*40*/, reliability /*20*/, activity /*10*/ },
  metrics: { activeItems, itemsInStock, itemsWithImages, ordersCompleted, ordersCancelled, ordersRefunded,
             completionRate /* 0-1 o null */, unitsSold, uniqueBuyers, repeatBuyers, ordersLast30d, memberSinceDays },
  generatedAt
}
// Con confidence 'low' o level 'new' conviene mostrar "Nueva" en vez de estrellas.
```

`percent`: `value` en puntos base (1500 = 15 %). `fixed`: monto en centavos.

## Comprador (token con rol `buyer`)

| Método | Ruta | Body / notas |
|---|---|---|
| GET | `/cart` | Carrito con precios y disponibilidad actuales |
| PUT | `/cart/items/:itemId` | `{quantity}` (1-999). **Reemplaza** la cantidad. 409 `INSUFFICIENT_STOCK` / `CART_OTHER_STORE` |
| DELETE | `/cart/items/:itemId` | Quita el ítem |
| DELETE | `/cart` | Vacía (204) |
| POST | `/orders` | **Checkout.** Header `Idempotency-Key`. 201 nuevo / 200 repetido. 400 `CART_EMPTY` |
| GET | `/orders` | `?status&limit&cursor` → `{orders, nextCursor}` |
| GET | `/orders/:id` | Pedido con `items` e `history` |
| POST | `/orders/:id/cancel` | Cancela (pendiente o pagado), libera/devuelve stock y reembolsa |
| POST | `/orders/:id/pay` | Header `Idempotency-Key`. 201/200. 409 `ORDER_NOT_PAYABLE` |
| GET | `/orders/:id/payments` | `{payments:[Payment]}` con reembolsos |
| GET/POST | `/me/wallets` | Lista / vincula wallets de Open Payments: `POST {address, name?, primary?}` (URL o `$host/ruta`; `name` es el apodo que el usuario le pone, máx. 60; la primera queda como principal; máx. 10) |
| PATCH/DELETE | `/me/wallets/:id` | `PATCH {name?, primary?: true}` renombra o cambia la principal. Al borrar la principal, la más antigua pasa a serlo |

```ts
Cart = { id, storeId, currency, lines: [{ itemId, name, sku, quantity,
  originalUnitAmount, discountUnitAmount, unitAmount, lineAmount, available, purchasable }],
  subtotalAmount,          // precio de lista
  discountAmount,          // solo descuentos de ítem
  coupon,                  // { id, code, title, type, value } | null  → cupón puesto en el carrito
  couponDiscountAmount,    // lo que descuenta el cupón hoy (0 si no aplica)
  couponError,             // null | código COUPON_* si el cupón puesto ya no aplica (p. ej. COUPON_MIN_NOT_MET)
  totalAmount }            // subtotal − descuentos de ítem − cupón: lo que se paga
// Un carrito = una sola sucursal. Deshabilita "comprar" si alguna línea tiene purchasable:false.

Order = { id, number, buyerId, storeId, status, currency,
  subtotalAmount, discountAmount /* ítems */, couponId, couponCode, couponDiscountAmount /* 0 si no hubo cupón */,
  totalAmount, commissionRate, commissionAmount /* sobre totalAmount, ya con el cupón */,
  expiresAt, createdAt,
  items?: [{ itemId, name, sku, quantity, originalUnitAmount, discountUnitAmount, unitAmount, lineAmount }],
  history?: [{ from, to, actorId, note, at }] }          // items/history solo en el detalle

Payment = { id, orderId, provider, providerRef, status, amount, currency, createdAt,
  refunds: [{ id, amount, reason, status, createdAt }] }
```

### Flujo de compra

1. `GET /stores` → elegir tienda → `GET /items?storeId=X` (o `GET /items` para búsqueda global) → `PUT /cart/items/:id` (varias veces) → `GET /cart`.
2. `POST /orders` (con `Idempotency-Key`): congela precios y **reserva el stock 15 min** (`expiresAt`).
3. `POST /orders/:id/pay` (con otra `Idempotency-Key`; con Open Payments puedes mandar `{walletId}` para pagar con otra wallet del comprador, si no usa la principal). Con `PAYMENT_PROVIDER=openpayments` la respuesta trae `checkout` (`receive`, `debit`, `fee`, `expiresAt`, `redirectUrl`): muéstralo, deja que el comprador acepte y abre `redirectUrl` completa (no la cortes en el `&`). La wallet vuelve al backend, que redirige a `FRONTEND_URL?payment=paid|failed|denied&order=ID`; confirma con `GET /orders/:id`. Si `expiresAt` pasó, repite `POST /pay` y se cotiza de nuevo. Lo siguiente describe el modo placeholder. El pago es un **placeholder** (`provider: "placeholder"`); el cobro se confirma por webhook del servidor, así que tras pagar haz **polling** de `GET /orders/:id` hasta `status: paid`.
4. Si no se paga en 15 min el pedido se cancela solo y se libera el stock.

### Estados del pedido

`pending_payment → paid → preparing → completed`, más `cancelled` y `refunded`. No hay envíos.
Cancelar: buyer (en `pending_payment` o `paid`), seller (hasta `preparing`).

## Vendedor (token con rol `seller`)

Todo se limita a la sucursal del vendedor (1 sucursal por organización). Lo ajeno → 403 `FORBIDDEN`.

### Organización y sucursal

| Método | Ruta | Notas |
|---|---|---|
| GET/PATCH | `/seller/organization` | PATCH: `legalName, tradeName, legalAddress, phone`. `taxId, legalId, country` son inmutables |
| PUT | `/seller/store/banner` | `multipart/form-data`, campo **`image`** (JPEG/PNG/WebP ≤5 MB). Se recorta a 1600×600. Reemplaza el anterior. → `{store}` |
| PUT | `/seller/store/icon` | Igual; se recorta a un círculo de 256×256 con fondo transparente |
| DELETE | `/seller/store/banner` · `/seller/store/icon` | Quita la imagen. → `{store}` |
| GET | `/seller/stats` | Lo de `StoreStats` más lo privado: `sales: {currency, completedAmount, last30dAmount, averageOrderAmount, refundedAmount}` (unidades menores), `ordersByStatus`, `alerts: {lowStockItems, itemsWithoutImages, draftItems}` y `tips` (consejos en texto). Nunca se cachea |
| GET/PATCH | `/seller/store` | PATCH: nombre, descripción, dirección, ciudad, teléfono, lat/lon, `status` (`active`\|`paused`) |
| DELETE | `/seller/store` | Cierra la sucursal (borrado lógico); el vendedor ya no podrá iniciar sesión (`STORE_REQUIRED`) |

### Categorías

| Método | Ruta | Notas |
|---|---|---|
| GET | `/seller/categories` | |
| POST | `/seller/categories` | `{name, slug?, parentId?}`. 409 `CATEGORY_SLUG_EXISTS` |
| PATCH | `/seller/categories/:id` | 400 `CATEGORY_CYCLE` |
| DELETE | `/seller/categories/:id` | 204; los ítems quedan sin categoría |

### Ítems

| Método | Ruta | Notas |
|---|---|---|
| GET | `/seller/items` | `?status&limit&cursor` |
| POST | `/seller/items` | `{sku, name, description, priceAmount, categoryId, status?('draft' por defecto), initialStock}`. 409 `SKU_ALREADY_EXISTS` |
| GET | `/seller/items/:id` | Detalle con imágenes, descuentos y stock. Incluye extra: `currentStock, reserved, status, updatedAt` |
| PATCH | `/seller/items/:id` | Parcial |
| DELETE | `/seller/items/:id` | 204 (borrado lógico) |
| POST | `/seller/items/:id/discounts` | `{type:'percent'\|'fixed', value, startsAt, endsAt}`. Solo uno a la vez: 409 `DISCOUNT_OVERLAP` |
| DELETE | `/seller/items/:id/discounts/:discountId` | Desactiva |
| POST | `/seller/items/:id/images` | `multipart/form-data`, campo **`image`** (JPEG/PNG/WebP, ≤5 MB, máx. 8 por ítem). Se recorta a 1024×1024 y pasa a WebP. 20/min |
| PUT | `/seller/items/:id/images/order` | `{ids:[…]}` con todas las imágenes en el orden nuevo |
| DELETE | `/seller/items/:id/images/:imageId` | 204 |

Estados de ítem: `draft` / `active` / `inactive`. Solo los `active` de una sucursal `active` se ven en el catálogo público.

### Inventario

| Método | Ruta | Body / notas |
|---|---|---|
| GET | `/seller/items/:id/stock` | `{stock:{itemId, currentStock, reserved, available, movementsTotal, consistent}}` |
| POST | `/seller/items/:id/stock` | `{type:'restock', quantity}` o `{type:'adjustment', delta, reason}` (el ajuste exige `reason`). → `{movement, stock}`. 409 `INSUFFICIENT_STOCK` si bajaría de 0 |
| GET | `/seller/items/:id/stock-movements` | `?limit(1-100)&cursor` → `{movements, nextCursor}` |

`Movement = { id, itemId, type('initial'|'restock'|'adjustment'|'sale'|'cancel'), quantityDelta, stockAfter, reason, orderId, createdAt }`

### Pedidos y pagos

| Método | Ruta | Notas |
|---|---|---|
| GET | `/seller/orders` | `?status&limit&cursor` |
| GET | `/seller/orders/:id` | Detalle e historial |
| POST | `/seller/orders/:id/status` | `{status:'preparing'\|'completed'\|'cancelled', note?}`. 409 `INVALID_TRANSITION` |
| GET | `/seller/orders/:id/payments` | |
| POST | `/seller/orders/:id/refunds` | `{amount?, reason?}`; sin `amount` reembolsa lo que falta. 409 `REFUND_EXCEEDS_PAYMENT`; para el total de un pedido sin completar, usar cancelar (`USE_CANCEL`) |

Transiciones del seller: `paid→preparing`, `preparing→completed`, y `cancelled` desde `paid`/`preparing`.

## Cupones

Cupones **de tienda** (los paga el vendedor), de **porcentaje** o **monto fijo**. Máximo **uno por pedido**. Se aplica sobre el precio ya rebajado por los descuentos de ítem. Importes en unidades menores; `value` de un porcentaje va en puntos base (1000 = 10 %, máximo 9000).

**Quién puede usar un cupón.** Debe estar en la *cartera* del comprador: o el vendedor se lo **asignó** por correo (`assigned`), o es **público** (`audience: "public"`) y el comprador lo **guarda** (`claimed`) o escribe su `code` al aplicarlo (se guarda solo). Los asignados a otras personas no se ven ni se pueden adivinar (404).

### Comprador (token `buyer`)

| Método | Ruta | Notas |
|---|---|---|
| GET | `/coupons` | Mis cupones y los públicos que puedo guardar. Query: `storeId`, `status` (`available`\|`used`\|`exhausted`\|`expired`\|`upcoming`\|`paused`), `limit` (1-50), `cursor`. → `{coupons:[BuyerCoupon], nextCursor}` |
| POST | `/coupons/:id/claim` | Guarda un cupón público. 201 si es nuevo, 200 si ya lo tenía. → `{coupon, created}` |
| PUT | `/cart/coupon` | Aplica un cupón al carrito: `{couponId}` o `{code}`. Reemplaza al anterior. Devuelve `{cart}` con los totales. Si no aplica responde un 4xx y **no cambia el carrito** |
| DELETE | `/cart/coupon` | Quita el cupón. Devuelve `{cart}` |
| POST | `/orders` | **Cambia:** usa el cupón del carrito. Lo vuelve a validar y reserva el uso; si falla responde el error `COUPON_*` y no crea el pedido |

```ts
BuyerCoupon = { id, storeId, code, title, description, type, value, maxDiscountAmount, minSubtotalAmount,
  startsAt, endsAt, maxRedemptions, perUserLimit, audience, status,
  store: { id, name, currency, iconUrl },
  inWallet, source /* 'assigned'|'claimed'|null */,
  state,      // available | used | exhausted | expired | upcoming | paused  (para mostrar el botón o la etiqueta)
  itemIds }   // productos a los que aplica; vacío = toda la tienda
```

**Flujo en el frontend:** listar `/coupons` → guardar los públicos → con el carrito armado, `PUT /cart/coupon` → mostrar `couponDiscountAmount` y `totalAmount` → `POST /orders`. Vuelve a leer `GET /cart` después de cambiar cantidades: si el carrito baja del mínimo el cupón sigue puesto pero `couponError` lo explica y el descuento pasa a 0.

**Cuándo se gasta un uso:** al hacer checkout queda *reservado*. Si el pedido se **cancela o vence sin pagarse**, el uso se devuelve y el cupón vuelve a estar disponible. Un reembolso posterior **no** lo devuelve.

### Vendedor (token `seller`)

| Método | Ruta | Notas |
|---|---|---|
| POST | `/seller/coupons` | Crea. Body: `title` (2-80), `description?` (≤300), `code?` (3-30 letras, dígitos, `-`, `_`; se guarda en mayúsculas, único por tienda), `type` (`percent`\|`fixed`), `value`, `maxDiscountAmount?` (solo `percent`), `minSubtotalAmount?`, `startsAt?` (por defecto ahora), `endsAt?`, `maxRedemptions?` (usos totales), `perUserLimit?` (por defecto 1), `audience?` (`assigned` por defecto \| `public`), `itemIds?` (solo esos productos; vacío = toda la tienda). → 201 `{coupon}` |
| GET | `/seller/coupons` | Query `status` (`active`\|`paused`\|`expired`), `limit`, `cursor`. → `{coupons, nextCursor}` |
| GET | `/seller/coupons/:id` | Detalle con `itemIds`, `redeemed` (usos vigentes) y `walletUsers` |
| PATCH | `/seller/coupons/:id` | Edita. Con usos ya hechos solo permite `title`, `description`, `status`, `endsAt` y `maxRedemptions` (409 `COUPON_IN_USE` si se intenta otro campo) |
| DELETE | `/seller/coupons/:id` | 204. 409 `COUPON_IN_USE` si hay pedidos esperando pago con él; el código queda libre |
| POST | `/seller/coupons/:id/assign` | `{emails:[…]}` (1-100). → `{assigned, alreadyHad, notFound}`; solo cuentas de comprador |
| GET | `/seller/coupons/:id/redemptions` | Usos: `{redemptions:[{id, orderId, orderNumber, userId, discountAmount, status('reserved'\|'released'), createdAt, releasedAt}], nextCursor}` |

### Errores de cupones

| Código | HTTP | Significa |
|---|---|---|
| `COUPON_NOT_FOUND` | 404 | No existe, es de otra persona o el código no es de esta tienda |
| `COUPON_NOT_ELIGIBLE` | 403 | Es público pero hay que guardarlo antes (`POST /coupons/:id/claim`) |
| `COUPON_WRONG_STORE` | 409 | El cupón es de otra tienda distinta a la del carrito |
| `COUPON_PAUSED` · `COUPON_NOT_STARTED` · `COUPON_EXPIRED` | 409 | Pausado por el vendedor, aún no empieza o ya venció |
| `COUPON_USER_LIMIT` · `COUPON_EXHAUSTED` | 409 | Ya lo usaste las veces permitidas · se agotaron los usos totales |
| `COUPON_MIN_NOT_MET` | 409 | El pedido no llega al mínimo (calculado sobre el precio con descuentos de ítem) |
| `COUPON_NOT_APPLICABLE` | 409 | Ningún producto del carrito entra en el cupón |
| `COUPON_CODE_EXISTS` | 409 | (vendedor) esa tienda ya tiene un cupón con ese código |
| `COUPON_IN_USE` | 409 | (vendedor) el cupón ya se usó o tiene pedidos pendientes |
| `COUPON_REQUIRED` · `CART_EMPTY` | 400 · 409 | Falta `couponId` o `code` · el carrito está vacío |

**Descuento:** `floor(base × value / 10000)` si es porcentaje, `value` si es fijo; nunca pasa de `maxDiscountAmount`, de la base aplicable ni deja el pedido en 0 (como mínimo se paga 1 unidad menor). La comisión del marketplace se calcula sobre el total ya con el cupón.

## Utilidad

`GET /countries` → `{ countries: [{ code: "CO", name: "Colombia" }, …] }` (249 países oficiales, ordenados por nombre en español, público y cacheable un día). Úsalo para el desplegable de país.

`GET /health` → `{"status":"ok"}` · `GET /ping` → `{"message":"pong","count":n}`

## Consejos para el frontend

- Guarda `token` y `user.role`; enruta la UI por rol y limpia el token ante un 401.
- Formatea dinero con `Intl.NumberFormat` usando `currency` y dividiendo entre 100 (si la moneda tiene 2 decimales).
- Genera un `Idempotency-Key` nuevo por intento de compra/pago y **reutilízalo en reintentos** del mismo intento.
- Trata 409 como errores de negocio recuperables y muestra el mensaje según `code`.
- Pagos: hoy es placeholder; no hay pasarela real todavía.
