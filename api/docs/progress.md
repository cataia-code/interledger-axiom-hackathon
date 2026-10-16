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

- `docs/requirements.html`: requerimientos funcionales por módulo (catálogo con descuentos, inventario, pedidos sin envío, pagos y comisión) y modelo de base de datos propuesto, con diagrama ER y preguntas abiertas. Es solo diseño: nada de eso está implementado.

## No hecho

- Envío real con Resend: el código existe pero nunca se probó con una API key real (en producción sin `RESEND_API_KEY` se usa el transport de consola).
- Recuperación de contraseña (los endpoints existen en el plugin pero no están probados ni se envía un correo específico).
- Almacén de rate limit compartido: hoy es en memoria (se reinicia con el servidor y no sirve con varias instancias).
- Detrás de un proxy hay que configurar `trust proxy` en Express y `advanced.ipAddress` en Better Auth; si no, el límite por IP se aplica a la IP del proxy.
- Ítems por sucursal (tabla y endpoints); ver, editar o borrar organización y sucursales (solo existe la creación).
- Unificar el formato de error de las rutas compartidas de Better Auth (`/auth/email-otp/*`, `/auth/sign-out`) con el del resto de la API.
- Pagos, pedidos, frontend/app móvil y despliegue quedan fuera de alcance.

## Notas y desviaciones

- Simplificación pedida: el inicio de sesión queda en contraseña + código por correo. Verificación de email opcional (antes obligatoria) y login con Google fuera del plan (puede añadirse después sin cambiar el modelo).

- **Limitación conocida (más probable ahora que la verificación es opcional):** iniciar sesión con código sobre una cuenta de contraseña **sin verificar** la verifica pero le borra la contraseña y revoca sus sesiones (comportamiento documentado de Better Auth contra el robo de cuentas). Después, el login con contraseña da 401 hasta restablecerla.
- Iniciar sesión con código ya no crea usuarios: las cuentas solo nacen en `buyer/sign-up` y `seller/sign-up`.

- Sesión móvil: se usará el token de sesión opaco y revocable de Better Auth (plugin `bearer`), **no** JWT de acceso + refresh rotativo como se pensó al inicio; Better Auth no ofrece refresh rotativo.
- `@better-auth/cli` está obsoleto; se usó `auth@latest generate`.
- `npm install` avisa de scripts de instalación pendientes de aprobar (`allow-scripts`); no fue necesario aprobarlos.
- `api/.env` está ignorado por git (contiene un `BETTER_AUTH_SECRET` aleatorio local). Las claves de `docker-compose.yml` son solo para desarrollo.
- `test/db.test.js` necesita Postgres arriba (`npm run db:up && npm run db:migrate`) para ejecutarse de verdad.
