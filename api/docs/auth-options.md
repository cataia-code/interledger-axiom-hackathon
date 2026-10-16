# Registro y login: opciones para la API

Documento de análisis (sin implementación). Supuestos: un usuario tiene un solo rol por ahora (comprador o vendedor) y los pagos quedan fuera. Estado actual de `api/`: Express ESM, sin base de datos ni auth, estructura route → controller → service. No se verificaron versiones de librerías; lo que depende de ellas va marcado "a confirmar".

## 1. Método de autenticación

| Opción | Pros | Contras | Esfuerzo |
|---|---|---|---|
| A. Correo + contraseña | Conocido, sin dependencias externas | Guardar hashes (argon2/bcrypt), recuperación de clave, más superficie de ataque | Medio |
| B. Solo magic link | Sin contraseñas que filtrar, ya verifica el email | Depende 100% del correo (entrega y latencia) | Bajo-medio |
| C. Ambos | Flexible | Dos flujos que mantener | Medio-alto |

Datos a guardar: email (normalizado en minúsculas, único), hash de clave (nullable), `email_verified_at`, y tokens de un solo uso guardados como hash, con expiración corta (10-15 min) y un campo de "usado".

**Recomendación MVP:** B (magic link) como método principal. Añadir contraseña después si hace falta.

## 2. Verificación de email

- **Flujo:** al registrarse se crea el token y se envía un enlace; al abrirlo se marca `email_verified_at`. Con magic link, el primer login exitoso ya verifica el correo.
- **Reenvío:** con límite de frecuencia y token anterior invalidado.
- **Proveedor:** SMTP genérico (nodemailer), o API de Resend/SES/Postmark. La API es más fácil de configurar; SES es más barato a escala.
- **Pruebas en desarrollo:** Mailpit/MailHog (SMTP local con bandeja web), o un "transport" que solo imprime el enlace en consola. Las pruebas automáticas inyectan un transport falso.

## 3. Login social (Google y otros)

- **Opciones:** (a) OIDC/OAuth a mano con una librería ligera; (b) Passport.js con estrategias; (c) servicio gestionado (ver punto 7).
- **Modelo:** tabla `identities` (`user_id`, `provider`, `provider_user_id`, `email`), de modo que un usuario tenga varias identidades.
- **Email coincidente:** vincular automáticamente solo si el proveedor reporta el email como verificado. Si no, pedir confirmar por correo. Si no, hay riesgo de toma de cuenta.
- **Recomendación:** Google primero (OIDC con PKCE) y añadir otros después sin cambiar el modelo.

## 4. Sesiones

| Opción | Pros | Contras |
|---|---|---|
| Cookie de sesión (id opaco en DB/Redis) | Revocación inmediata, simple, segura con `httpOnly` | Requiere almacén de sesiones, CSRF a considerar |
| JWT access corto + refresh rotativo | Sin estado en lecturas, sirve a apps móviles | Revocación más compleja, riesgo si se guarda mal |

- **Comunes:** rate limiting en endpoints de auth (por IP y por email), cookies `httpOnly` + `Secure` + `SameSite`, y logout que invalida en servidor.
- **Recomendación:** cookie de sesión si el cliente es web. JWT con refresh solo si habrá app móvil o terceros.

## 5. Roles

- **Modelo:** columna `role` en `users` (`buyer` | `seller`), con perfil de tienda aparte en una tabla `stores` ligada al usuario vendedor.
- **Un rol o varios:** un rol por usuario es lo más simple (quien quiera comprar y vender necesitaría dos cuentas). Alternativa: tabla `user_roles` (muchos a muchos), más flexible pero más compleja. Conviene decidirlo ahora porque cambiarlo luego duele.
- **Asignación:** comprador por defecto. El vendedor se elige explícitamente en el registro o, mejor, se "promueve" con un flujo de alta de tienda. Nunca aceptar el rol desde el cliente sin validación.
- **Autorización:** middleware `requireAuth` y `requireRole('seller')`.
- **Comprador → vendedor:** un pedido (`orders`) referencia `buyer_id` y `store_id`. Los permisos se comprueban por propiedad (el vendedor solo ve pedidos de su tienda). Los pagos se diseñan después.

## 6. Persistencia

- **Motor:** PostgreSQL recomendado (producción y desarrollo con Docker). SQLite sirve para arrancar rápido.
- **Acceso:** Prisma (productivo, migraciones cómodas), Drizzle (ligero, cercano a SQL) o Knex (simple). Versiones y soporte ESM: a confirmar.
- **Tablas:**
  - `users` (id, email, email_verified_at, password_hash?, role, created_at)
  - `identities` (user_id, provider, provider_user_id)
  - `auth_tokens` (user_id, tipo, token_hash, expires_at, used_at)
  - `sessions` (si se usan cookies)
  - `stores` (user_id, nombre, …)

## 7. Construir o comprar

| Opción | Pros | Contras |
|---|---|---|
| Propia | Control total, sin costo recurrente, datos propios | Más código de seguridad que mantener |
| Better Auth / Lucia (librería) | Menos trabajo, datos en tu DB | Mantenimiento y madurez a confirmar |
| Passport | Muchas estrategias | Solo cubre parte del trabajo; la calidad de las estrategias varía |
| Servicio gestionado (Auth0, Clerk, Supabase Auth) | Rápido, social + magic link ya hechos | Dependencia del proveedor, costo al crecer, datos fuera |

## Combinaciones razonables

| Combinación | Esfuerzo | Control | Riesgo |
|---|---|---|---|
| Propia: magic link + Google + cookie + Postgres | Medio | Alto | Medio |
| Librería (Better Auth) + Postgres | Bajo-medio | Alto | Bajo-medio |
| Servicio gestionado + roles propios | Bajo | Bajo | Bajo, con dependencia |

**Recomendación MVP:** magic link + Google, cookie de sesión, PostgreSQL, rol único. Entre propia y librería, preferiría una librería probada si cubre estos casos (a confirmar), porque reduce el código de seguridad propio. Si se prefiere entender y controlar todo, la propia es viable en pocas fases.

## Decisiones tomadas

1. Login: magic link **y** contraseña.
2. Roles: un rol por usuario (`buyer` | `seller`).
3. Cliente: app móvil. Sesión: token de sesión opaco y revocable de Better Auth (plugin `bearer`), sin JWT ni refresh rotativo (decidido tras ver que Better Auth no los ofrece). Sin cookies. El magic link necesita deep link/universal link (o un código de un solo uso como alternativa). Google se haría con el login nativo del móvil y la API verificando el ID token (a confirmar).
4. Auth: librería probada, a verificar que soporte móvil, magic link, contraseña y Google.
5. Base de datos: PostgreSQL con Drizzle o Prisma (a elegir al verificar compatibilidad con la librería del punto 4).

6. Vendedor: el usuario se registra como `buyer` y luego crea su tienda (alta posterior); al crearla pasa a `seller`.
7. Correo: proveedor gratuito y fácil de configurar, al ser un prototipo. Propuesta: transport que imprime el código en consola/Mailpit en desarrollo y Resend (plan gratuito, a confirmar límites) para envíos reales.
8. Vinculación por email: automática solo si el proveedor (Google) marca el email como verificado.

Todas las decisiones están tomadas.

### Simplificación posterior
El login queda en contraseña + código por correo. La verificación del email es opcional (no bloquea el login) y el login con Google se retira del plan; puede añadirse más adelante sin cambiar el modelo.

## Decisiones pendientes (original)

1. ¿Magic link solo, o también contraseña? *Sugerido: solo magic link.*
2. ¿Un rol por usuario o varios? *Sugerido: uno por ahora.*
3. ¿Cómo se vuelve alguien vendedor: elección al registrarse o alta posterior de tienda? *Sugerido: alta posterior.*
4. ¿El cliente será web, móvil o ambos? Define cookies o JWT. *Sugerido: cookies si es solo web.*
5. ¿Auth propia, librería o servicio gestionado? *Sugerido: librería, si se verifica.*
6. ¿Proveedor de correo? *Sugerido: Resend, o SMTP con Mailpit en desarrollo.*
7. ¿Base de datos y ORM? *Sugerido: PostgreSQL + Drizzle o Prisma.*
8. ¿Vincular cuentas por email coincidente automáticamente? *Sugerido: solo si el proveedor lo marca como verificado.*

## Orden de implementación por fases

1. Base de datos, migraciones y tabla `users`.
2. Magic link y verificación de email, con transport de correo de prueba.
3. Sesiones, logout y rate limiting.
4. Roles y middleware de autorización.
5. Google OIDC e identidades vinculadas.
6. Perfil de tienda y relación comprador → vendedor (pedidos, sin pagos).

### Login separado por rol
Decidido: mismas tablas (`user`, `session`, `account`), rutas separadas `/auth/buyer/*` y `/auth/seller/*`, y cada login solo acepta su rol. El vendedor se registra con su tienda en un solo paso (nunca existe un seller sin tienda); se elimina el alta posterior `POST /stores`. Las cuentas solo se crean por los registros por rol (sin registro por código). Un correo no puede ser comprador y vendedor a la vez.

### Organización y sucursales
Decidido: entre `user` y `store` va una tabla `organization` con los datos legales (1:1 con el usuario seller). `store` pasa a ser una sucursal de la organización (dirección, ciudad, teléfono; llevará ítems). El registro de seller crea usuario + organización + primera sucursal en un solo paso; más sucursales se añaden con `POST /stores`. Los campos legales concretos (razón social, identificación fiscal, país, dirección) son provisionales y se ajustarán a los requisitos legales reales.
