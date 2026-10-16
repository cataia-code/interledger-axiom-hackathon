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

## No hecho

- Envío real con Resend: el código existe pero nunca se probó con una API key real (en producción sin `RESEND_API_KEY` se usa el transport de consola).
- Recuperación de contraseña (los endpoints existen en el plugin pero no están probados ni se envía un correo específico).
- Almacén de rate limit compartido: hoy es en memoria (se reinicia con el servidor y no sirve con varias instancias).
- Detrás de un proxy hay que configurar `advanced.ipAddress` (cabeceras de confianza); si no, el límite por IP puede falsearse con `X-Forwarded-For`.
- Fase 5: tabla `stores` y `POST /api/v1/stores` (el usuario pasa a `seller`).
- Pagos, pedidos, frontend/app móvil y despliegue quedan fuera de alcance.

## Notas y desviaciones

- Simplificación pedida: el inicio de sesión queda en contraseña + código por correo. Verificación de email opcional (antes obligatoria) y login con Google fuera del plan (puede añadirse después sin cambiar el modelo).

- **Limitación conocida (más probable ahora que la verificación es opcional):** iniciar sesión con código sobre una cuenta de contraseña **sin verificar** la verifica pero le borra la contraseña y revoca sus sesiones (comportamiento documentado de Better Auth contra el robo de cuentas). Después, el login con contraseña da 401 hasta restablecerla.
- Iniciar sesión con código con un correo nuevo crea el usuario ya verificado con `name` vacío; falta decidir si se permite (hoy sí) o se pide nombre.

- Sesión móvil: se usará el token de sesión opaco y revocable de Better Auth (plugin `bearer`), **no** JWT de acceso + refresh rotativo como se pensó al inicio; Better Auth no ofrece refresh rotativo.
- `@better-auth/cli` está obsoleto; se usó `auth@latest generate`.
- `npm install` avisa de scripts de instalación pendientes de aprobar (`allow-scripts`); no fue necesario aprobarlos.
- `api/.env` está ignorado por git (contiene un `BETTER_AUTH_SECRET` aleatorio local). Las claves de `docker-compose.yml` son solo para desarrollo.
- `test/db.test.js` necesita Postgres arriba (`npm run db:up && npm run db:migrate`) para ejecutarse de verdad.
