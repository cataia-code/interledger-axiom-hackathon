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
| 409 | Conflicto de estado | `INSUFFICIENT_STOCK`, `CART_OTHER_STORE`, `ITEM_UNAVAILABLE`, `INVALID_TRANSITION`, `ORDER_NOT_PAYABLE`, `SKU_ALREADY_EXISTS`, `DISCOUNT_OVERLAP`, `CATEGORY_SLUG_EXISTS`, `REFUND_EXCEEDS_PAYMENT`, `USE_CANCEL`, `TAX_ID_ALREADY_EXISTS`, `LEGAL_ID_ALREADY_EXISTS` |
| 413 | Imagen > 5 MB | `IMAGE_TOO_LARGE` |
| 422 | Correo ya registrado | `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` |
| 429 | Rate limit | `RATE_LIMITED` |
| 500 | Error interno | `INTERNAL_ERROR` |

## Autenticación

Cada rol tiene sus propias rutas. Un login solo acepta cuentas de su rol (si no, 403 `WRONG_ROLE`). No se puede enviar el rol desde el cliente: lo fija la ruta de registro.

Respuesta de sign-up/sign-in: `{ "token": "…", "user": { "id", "email", "name", "role", "emailVerified" } }` (el seller además recibe `organization` y `store` en el sign-up). **Guarda el token y envíalo en cada petición protegida.**

| Método | Ruta | Body | Notas |
|---|---|---|---|
| POST | `/auth/buyer/sign-up` | `{email, password(≥8), name}` | 201. Envía código de verificación al correo (verificar es opcional) |
| POST | `/auth/seller/sign-up` | ver abajo | 201. Crea usuario + organización + sucursal en un paso |
| POST | `/auth/buyer/sign-in` · `/auth/seller/sign-in` | `{email, password}` | 200 |
| POST | `/auth/buyer/sign-in/otp` · `/auth/seller/sign-in/otp` | `{email, otp}` | Login con código de 6 dígitos. No crea cuentas |
| POST | `/auth/email-otp/send-verification-otp` | `{email, type}` | `type`: `sign-in` \| `email-verification` \| `forget-password`. 3/min |
| POST | `/auth/email-otp/verify-email` | `{email, otp}` | Marca el correo verificado |
| POST | `/auth/email-otp/request-password-reset` | `{email}` | Envía código |
| POST | `/auth/email-otp/reset-password` | `{email, otp, password}` | Cambia contraseña y revoca sesiones previas |
| POST | `/auth/sign-out` | `{}` + Bearer | Revoca el token |
| GET | `/me` | | `{user:{id,email,name,role,emailVerified,phone}}` |
| PATCH | `/me` | `{name?(1-80), phone?(≤30 \| null)}` | |

Códigos OTP: 6 dígitos, caducan en 10 min, 3 intentos. Los códigos nuevos invalidan el anterior.

**Body de `seller/sign-up`:**

```json
{
  "email": "luna@ejemplo.com", "password": "Password-12345", "name": "Luna",
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
| GET | `/items` | Filtros: `categoryId`, `storeId`, `q` (texto), `sort` (`newest`\|`price_asc`\|`price_desc`), `limit` (1-50), `cursor`. → `{items:[Item], nextCursor}` |
| GET | `/items/:id` | → `{item: Item}` |
| GET | `/stores` | → `{stores: PublicStore[], nextCursor}`; devuelve tiendas del directorio. Ejemplo actualizado recibido el 2026-10-16 |
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
PublicStore = { id, name, description, city, address, latitude, longitude, currency, bannerUrl, iconUrl, status }
Category    = { id, storeId, parentId, name, slug }   // árbol vía parentId
```

`percent`: `value` en puntos base (1500 = 15 %). `fixed`: monto en centavos. `bannerUrl` es la imagen de portada y `iconUrl` el logo; el ejemplo usa rutas relativas `/uploads/stores/:id/...` resueltas contra el host de API.

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

```ts
Cart = { id, storeId, currency, lines: [{ itemId, name, sku, quantity,
  originalUnitAmount, discountUnitAmount, unitAmount, lineAmount, available, purchasable }], …totales }
// Un carrito = una sola sucursal. Deshabilita "comprar" si alguna línea tiene purchasable:false.

Order = { id, number, buyerId, storeId, status, currency,
  subtotalAmount, discountAmount, totalAmount, commissionRate, commissionAmount,
  expiresAt, createdAt,
  items?: [{ itemId, name, sku, quantity, originalUnitAmount, discountUnitAmount, unitAmount, lineAmount }],
  history?: [{ from, to, actorId, note, at }] }          // items/history solo en el detalle

Payment = { id, orderId, provider, providerRef, status, amount, currency, createdAt,
  refunds: [{ id, amount, reason, status, createdAt }] }
```

### Flujo de compra

1. `GET /items` → `PUT /cart/items/:id` (varias veces) → `GET /cart`.
2. `POST /orders` (con `Idempotency-Key`): congela precios y **reserva el stock 15 min** (`expiresAt`).
3. `POST /orders/:id/pay` (con otra `Idempotency-Key`). El pago es un **placeholder** (`provider: "placeholder"`); el cobro se confirma por webhook del servidor, así que tras pagar haz **polling** de `GET /orders/:id` hasta `status: paid`.
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

## Utilidad

`GET /health` → `{"status":"ok"}` · `GET /ping` → `{"message":"pong","count":n}`

## Consejos para el frontend

- Guarda `token` y `user.role`; enruta la UI por rol y limpia el token ante un 401.
- Formatea dinero con `Intl.NumberFormat` usando `currency` y dividiendo entre 100 (si la moneda tiene 2 decimales).
- Genera un `Idempotency-Key` nuevo por intento de compra/pago y **reutilízalo en reintentos** del mismo intento.
- Trata 409 como errores de negocio recuperables y muestra el mensaje según `code`.
- Pagos: hoy es placeholder; no hay pasarela real todavía.
