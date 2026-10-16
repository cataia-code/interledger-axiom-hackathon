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

## No hecho

- Los endpoints HTTP de auth (`/api/v1/auth/*`) **no están montados** en `app.js`: Better Auth solo está configurado y probado llamando a su API directamente. La verificación anterior no cubre HTTP.
- Fase 2: envío de código por correo (plugin `emailOTP`), verificación obligatoria de email, login con código, reenvío con límite de frecuencia y rate limiting. Hoy el registro no envía ni exige nada.
- Transport de correo (consola en desarrollo, Resend en producción).
- Fase 3: plugin `bearer` para la sesión móvil, `requireAuth`, `requireRole`, `GET /api/v1/auth/me`.
- Fase 4: login con Google por ID token y la vinculación de cuentas por email verificado (las reglas de vinculación de Better Auth no se han revisado).
- Fase 5: tabla `stores` y `POST /api/v1/stores` (el usuario pasa a `seller`).
- Pagos, pedidos, frontend/app móvil y despliegue quedan fuera de alcance.

## Notas y desviaciones

- Sesión móvil: se usará el token de sesión opaco y revocable de Better Auth (plugin `bearer`), **no** JWT de acceso + refresh rotativo como se pensó al inicio; Better Auth no ofrece refresh rotativo.
- `@better-auth/cli` está obsoleto; se usó `auth@latest generate`.
- `npm install` avisa de scripts de instalación pendientes de aprobar (`allow-scripts`); no fue necesario aprobarlos.
- `api/.env` está ignorado por git (contiene un `BETTER_AUTH_SECRET` aleatorio local). Las claves de `docker-compose.yml` son solo para desarrollo.
- `test/db.test.js` necesita Postgres arriba (`npm run db:up && npm run db:migrate`) para ejecutarse de verdad.
