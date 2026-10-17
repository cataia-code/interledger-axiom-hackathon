# Estado de la API: qué está hecho y qué no

Rama: `feature/base_api_nodejs`. Decisiones de diseño en `auth-options.md`.

## Hecho

### Base de la API (Express)
- Express 5 con JavaScript ESM sobre Node 24, estructura `src/{config,middlewares,routes,controllers,services}`.
- Middlewares: `helmet`, `cors` (origen por `CORS_ORIGIN`), `express.json`, logging con `pino-http` (desactivado en `NODE_ENV=test`).
- Errores centralizados (`src/middlewares/errorHandler.js`): 404 en JSON y handler global `{ error: { message, code } }`, sin filtrar el mensaje de errores 500 en producción.
- Rutas bajo `/api/v1`: `GET /health` y `GET /ping` (ejemplo de route → controller → service).
- `src/server.js` con apagado ordenado (SIGTERM/SIGINT).
- ESLint, `.editorconfig`, `.env.example`, `.gitignore`.
- Pruebas con `node --test` + supertest: health, ping, 404 y handler de errores.

### Fase 1: base de datos
- PostgreSQL 17 con `docker-compose.yml` (usuario/clave/base `axiom`, puerto 5432).
- `drizzle-orm` + `pg`; conexión en `src/db/index.js`.
- Better Auth 1.7.10 configurado de forma mínima en `src/auth/index.js`: `basePath` `/api/v1/auth`, correo + contraseña activado y campo `role` (`buyer` por defecto, obligatorio, no aceptado desde el cliente).
- Esquema generado con el CLI de Better Auth en `src/db/schema.js`: `user`, `session`, `account`, `verification`.
- Migración `drizzle/0000_shallow_sugar_man.sql`; scripts `db:up`, `db:migrate`, `db:generate`, `auth:schema`.
- `test/db.test.js`: comprueba que `user.role` existe, es `NOT NULL` y por defecto `buyer` (se salta con aviso si la base no responde).

### Verificación realizada
- `npm run lint` limpio; `npm test` 5/5.
- Migración aplicada sobre una base nueva: crea las 4 tablas.
- `drizzle-kit generate` sin cambios (esquema y migración coinciden).
- Con un script temporal contra Postgres real: registro crea `buyer` con `emailVerified=false`; correo duplicado rechazado; enviar `role: seller` en el registro se ignora; login devuelve token de sesión; datos de prueba borrados.

### Fase 2: registro, verificación y login por correo
- Endpoints de Better Auth montados en `/api/v1/auth/*` (antes de `express.json()` en `src/app.js`): `sign-up/email`, `sign-in/email`, `email-otp/send-verification-otp`, `email-otp/verify-email`, `sign-in/email-otp`, entre otros.
- Plugin `emailOTP`: código de 6 dígitos, caduca a los 10 min, 3 intentos, guardado con hash; el envío no se espera (evita diferencias de tiempo).
- Registro con contraseña: inicia sesión de inmediato (devuelve `token`) y envía un código de verificación. La verificación es opcional: el login con contraseña no la exige. Registrar un correo ya existente responde 422 (`USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`).
- Login con código de un solo uso (también registra a un correo nuevo, ver notas).
- Reenvío: pedir un código nuevo invalida el anterior.
- Rate limiting de Better Auth activo en todos los entornos: 5/min en sign-up, sign-in, sign-in con código y verify-email; 3/min al pedir código (por IP).
- Correo: `src/mail/index.js`, transport de consola (desarrollo y tests; imprime el código y lo guarda en `outbox`) y Resend en producción (`RESEND_API_KEY`, `MAIL_FROM`).
- `test/auth.test.js` (8 pruebas HTTP con supertest contra Postgres real). El script `npm test` ahora fija `NODE_ENV=test`.
- Verificación manual con `curl` contra el servidor en marcha: registro solo con código, y cuenta sin verificar + login con código.

### Fase 3: sesión móvil y autorización
- Plugin `bearer`: el `token` que devuelven el registro y el login (o la cabecera `set-auth-token`, firmado) se envía en `Authorization: Bearer <token>`.
- `src/middlewares/auth.js`: `requireAuth` (401 `UNAUTHORIZED` si no hay sesión válida; deja `req.auth`) y `requireRole(...roles)` (403 `FORBIDDEN`).
- `GET /api/v1/me` (protegido): `{ user: { id, email, name, role, emailVerified } }`. Está en `/api/v1/me` y no en `/api/v1/auth/me` porque `/api/v1/auth/*` lo atiende Better Auth.
- `POST /api/v1/auth/sign-out` con el token lo revoca (después `/me` da 401).
- `test/me.test.js`: 5 pruebas (token crudo y firmado, sin token o inválido, sign-out, `requireRole` con buyer y seller). `npm test`: 18/18.

### Fase 4: tiendas (reemplazada por la fase 6)
- Primera versión: tabla `store` ligada directamente al usuario y `POST /stores`. Ver fase 6.

### Fase 5: login separado por rol (comprador / vendedor)
- Rutas por rol bajo `/api/v1/auth`: `buyer/sign-up`, `buyer/sign-in`, `buyer/sign-in/otp`, `seller/sign-up`, `seller/sign-in`, `seller/sign-in/otp` (`src/routes/roleAuth.js`, `controllers/roleAuthController.js`, `services/roleAuthService.js`). Llaman a Better Auth por dentro y traducen sus errores al formato de la API.
- Mismas tablas y sesiones; **cada login solo acepta su rol**: si el rol no coincide, 403 `WRONG_ROLE`, se revoca la sesión recién creada y no se devuelve token. El rol se comprueba después de validar la contraseña, para no revelar qué correos existen.
- **El vendedor siempre tiene organización y sucursal** (ver fase 6): `seller/sign-up` crea todo junto y, si falla, borra el usuario.
- Cerradas las rutas genéricas `POST /auth/sign-up/email`, `/auth/sign-in/email` y `/auth/sign-in/email-otp` (404 `ENDPOINT_MOVED`).
- El login con código ya **no crea cuentas** (`disableSignUp: true`): solo se nace por los registros por rol.
- Un comprador no puede convertirse en vendedor por su cuenta: no hay conversión (decidido: mismo correo no puede tener ambos roles).
- Rate limit propio de las rutas por rol (`express-rate-limit`, 5/min por ruta e IP, 429 `RATE_LIMITED`), porque Better Auth no limita las llamadas internas.
- Tests: `test/sellers.test.js` (registro de seller con tienda, validación sin residuos, correo existente, login por contraseña y código, cruce de roles, sesión revocada, mismo 401 para contraseña incorrecta y correo desconocido, seller sin tienda, rate limit, `/stores` inexistente); `auth.test.js` y `me.test.js` adaptados. `npm test`: 29/29.
- Documentación: el modelo relacional del HTML agrupa las tablas en **Autenticación** (`user`, `session`, `account`, `verification`) y **Negocio** (`store`).

### Fase 6: organización y sucursales
- Nueva tabla intermedia `organization` entre `user` y `store`: datos legales del vendedor (`legal_name`, `trade_name`, `tax_id` único, `country` ISO de 2 letras, `legal_address`, `phone`), 1:1 con el usuario seller (`user_id` único, cascada).
- `store` pasa a ser una **sucursal**: cuelga de `organization` (`organization_id`, cascada), con `address`, `city`, `phone` y `description`; nombre único dentro de la organización. Ya no tiene `user_id`.
- Tablas propias en `src/db/business.js` (reemplaza a `stores.js`). Migraciones `0002` (elimina la `store` anterior) y `0003` (crea `organization` y la nueva `store`); se hicieron en dos pasos para evitar que drizzle-kit pregunte por renombres. Los datos de `store` anteriores se pierden (solo había datos de prueba).
- `POST /auth/seller/sign-up` ahora recibe `organization` y `store`, valida todo antes de crear nada y crea usuario + organización + primera sucursal + rol `seller` (compensación: si falla, borra el usuario). `TAX_ID_ALREADY_EXISTS` (409) si la identificación fiscal ya existe.
- `POST /api/v1/stores` vuelve, ahora solo para sellers (`requireAuth` + `requireRole('seller')`): añade una sucursal a su organización (409 `STORE_NAME_ALREADY_EXISTS` si repite nombre).
- `seller/sign-in` exige organización y al menos una sucursal (403 `ORGANIZATION_REQUIRED` / `STORE_REQUIRED`).
- Código: `services/storeService.js` (validaciones), `services/sellerService.js` (creación y consultas), `controllers/storeController.js`.
- Tests: `test/sellers.test.js` ampliado. `npm test`: 32/32.
- HTML: el diagrama del grupo Negocio muestra `organization` → `store`.

## Diseño del marketplace

- `docs/requirements.html`: requerimientos funcionales por módulo (catálogo con descuentos, inventario, pedidos sin envío, pagos y comisión) y modelo de base de datos, con estado de cada uno (qué hay y qué no), diagrama ER y preguntas abiertas.

### Desarrollo del marketplace (fases 0 a 6, plan aprobado)

Implementa los requerimientos MVP de `docs/requirements.html` (51 de 61; el resto es "Posterior" salvo el formato de error único, RF-TRA-04).

- **Fase 0, ids numéricos y sucursal única.** Better Auth con `advanced.database.generateId: 'serial'`; `organization` y `store` con `bigint identity`. Una sola migración limpia (`drizzle/0000_init.sql`; se reinició la base de desarrollo). `organization.legal_id`; `store`: `latitude`, `longitude`, `legal_id`, `currency`, `status`, `deleted_at` y UNIQUE sobre `organization_id`. `POST /stores` se retiró. Los ids viajan como números.
- **Fase 1, perfil y sucursal.** `PATCH /me` (nombre, teléfono; columna `user.phone`), recuperación de contraseña con código (rutas de `email-otp`, con rate limit), `GET/PATCH /seller/organization`, `GET/PATCH/DELETE /seller/store`, `GET /stores/:id`.
- **Fase 2, catálogo.** `src/db/catalog.js`: `category` (por sucursal), `item`, `item_discount`, `item_image`. CRUD del seller, descuentos (uno vigente a la vez), imágenes con `multer` + `sharp` (WebP 1024×1024 en disco local, hasta 8 por ítem, servidas en `/uploads`), listado público con búsqueda, filtros, orden y cursor.
- **Fase 3, inventario.** `src/db/inventory.js`: `stock_movement` (libro) y `stock_reservation`. `applyStockMovement` es la única vía para cambiar `item.current_stock`; bloqueo de filas y pruebas de concurrencia. El público ve `available`, no el stock real.
- **Fase 4, carrito y pedidos.** `src/db/orders.js`. Carrito de una sola sucursal; checkout idempotente (`Idempotency-Key`) con precios congelados, reserva de 15 min y comisión 0.1 %; máquina de estados (`orderStateMachine.js`) con historial; cancelación del buyer y del seller; job que cancela pedidos sin pagar. Los ítems se bloquean antes de insertar `order_item` para evitar interbloqueos.
- **Fase 5, pagos.** `src/db/payments.js` y `src/payments/placeholder.js`. Pago iniciado por el buyer, confirmación por webhook propio (`X-Webhook-Secret`), eventos procesados una sola vez, reintentos, reembolsos totales y parciales sin superar lo cobrado, y reembolso automático si el dinero llega tarde.
- **Fase 6, cierre.** Revisión de permisos por propiedad (403/404), pruebas de carrera, `docs/api-usage.html` y `docs/requirements.html` actualizados.
- **Verificación:** `npm run lint` y `npm test` (65 pruebas, estables en varias ejecuciones) y un recorrido real contra el servidor (registro → ítem con descuento → checkout → pago → completar → reembolso).

### Auditoría y endurecimiento

- Auditoría completa en `docs/audit-report.html`: 65 pruebas, 116 comprobaciones de caja negra, 22 de integridad de datos, rendimiento y escala (100 000 ítems).
- Correcciones: manejador `pool.on('error')` (la API se caía si Postgres cortaba una conexión), rate limit en toda la API y en checkout, pago, imágenes y webhook (`src/middlewares/rateLimit.js`), `CORS_ORIGIN` obligatorio y sin `*` en producción, `TRUST_PROXY`, e índices (`pg_trgm`, precio) en la migración `0006`. Pruebas: 71/71 (`test/hardening.test.js`).

## Open Payments (rama `feature/init_openpayment`)

- Proveedor `openpayments` (`src/payments/openpayments.js`, SDK `@interledger/open-payments`) según `payments/INTEGRACION.md`: `POST /orders/:id/pay` devuelve cotización, comisión, vencimiento y `redirectUrl`; `GET /payments/openpayments/return/:orderId` verifica el hash, continúa el grant, crea el outgoing payment y marca el pedido pagado solo si llegó el monto cotizado.
- Wallets por usuario (varias, con `name` que define el usuario y una principal): `GET/POST /me/wallets`, `PATCH/DELETE /me/wallets/:id` (tabla `user_wallet`, migraciones `0008` y `0009`). El comprador paga con su principal o elige otra con `walletId` en `POST /orders/:id/pay`; la tienda cobra en la principal del dueño. Sin wallet: 409 `BUYER_WALLET_REQUIRED` / `SELLER_WALLET_REQUIRED`.
- Tabla `payment_session` guarda lo que hace falta entre el checkout y la vuelta (nonce, continuación, cotización). Cotización vencida: se pide otra, nunca se reutiliza.
- Se activa con `PAYMENT_PROVIDER=openpayments`; `placeholder` sigue por defecto (dev y tests). Pruebas: 93/93 (`test/openpayments.test.js` con cliente simulado).
- Fuera de alcance, como indica el documento: la devolución. Con Open Payments un reembolso solo se registra (`manual_…`), no mueve dinero.
- Sin probar contra la red real: faltan credenciales (`OP_*`) y dos wallets de `wallet.interledger-test.dev`.

## No hecho

- Liquidación al seller y conciliación. Falta definir quién absorbe la comisión.
- Notificaciones, auditoría, variantes de ítem, importación CSV, aviso de stock bajo, eliminar cuenta (todo "Posterior").
- Imágenes en un bucket (hoy disco local), almacén de rate limit compartido (hoy en memoria; con varias instancias hace falta Redis).
- Envío real con Resend: nunca se probó con una API key real.
- Unificar el formato de error de las rutas compartidas de Better Auth (`/auth/email-otp/*`, `/auth/sign-out`) con el del resto (RF-TRA-04).
- Datos legales de `organization` provisionales; un reembolso no ajusta la comisión ya guardada.

## Notas y desviaciones

- Simplificación pedida: el inicio de sesión queda en contraseña + código por correo. Verificación de email opcional (antes obligatoria) y login con Google fuera del plan (puede añadirse después sin cambiar el modelo).

- **Limitación conocida (más probable ahora que la verificación es opcional):** iniciar sesión con código sobre una cuenta de contraseña **sin verificar** la verifica pero le borra la contraseña y revoca sus sesiones (comportamiento documentado de Better Auth contra el robo de cuentas). Después, el login con contraseña da 401 hasta restablecerla.
- Iniciar sesión con código ya no crea usuarios: las cuentas solo nacen en `buyer/sign-up` y `seller/sign-up`.

- Sesión móvil: se usará el token de sesión opaco y revocable de Better Auth (plugin `bearer`), **no** JWT de acceso + refresh rotativo como se pensó al inicio; Better Auth no ofrece refresh rotativo.
- `@better-auth/cli` está obsoleto; se usó `auth@latest generate`.
- `npm install` avisa de scripts de instalación pendientes de aprobar (`allow-scripts`); no fue necesario aprobarlos.
- `api/.env` está ignorado por git (contiene un `BETTER_AUTH_SECRET` aleatorio local). Las claves de `docker-compose.yml` son solo para desarrollo.
- `test/db.test.js` necesita Postgres arriba (`npm run db:up && npm run db:migrate`) para ejecutarse de verdad.
