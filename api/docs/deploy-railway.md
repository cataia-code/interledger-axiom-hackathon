# Despliegue en Railway

La API se despliega como un servicio desde GitHub (`api/Dockerfile`) con un servicio PostgreSQL y un volumen para las imágenes.

## Qué hace el contenedor
`api/Dockerfile` instala solo dependencias de producción y arranca con
`node src/db/migrate.js && node src/server.js`: aplica las migraciones pendientes (`api/drizzle/`) y levanta la API. Si una migración falla, el despliegue falla y no se sirve tráfico con el esquema a medias.

## Configuración en Railway
**Servicio de la API** (repositorio `cataia-code/interledger-axiom-hackathon`, rama `master`):

| Ajuste | Valor |
|---|---|
| Root Directory | `/api` (así Railway usa `api/Dockerfile`) |
| Networking | dominio público, puerto de destino `3000` |
| Healthcheck Path | `/api/v1/health` |
| Volumen | montado en `/data` (imágenes subidas) |

**Variables** (las secretas se generan en Railway; ninguna vive en el repositorio):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (red privada) |
| `BETTER_AUTH_SECRET` | `${{secret(64)}}` |
| `BETTER_AUTH_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `CORS_ORIGIN` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (añade aquí los orígenes de las apps web, separados por comas) |
| `TRUST_PROXY` | `1` |
| `PAYMENT_WEBHOOK_SECRET` | `${{secret(32)}}` |
| `UPLOAD_DIR` | `/data/uploads` |

Para el correo (códigos de acceso): `RESEND_API_KEY` y `MAIL_FROM`, ver la sección *Correo con Resend*. Opcionales: `COMMISSION_RATE`, `RESERVATION_TTL_MINUTES`.

**Servicio Postgres:** plantilla de PostgreSQL de Railway con su volumen. La extensión `pg_trgm` la crea la migración `0006`.

## Pagos con Open Payments

Por defecto `PAYMENT_PROVIDER=placeholder` (simulado). Para usar la red de pruebas de Interledger:

| Variable | Valor |
|---|---|
| `PAYMENT_PROVIDER` | `openpayments` |
| `OP_CLIENT_WALLET_ADDRESS` | wallet de la app en `wallet.interledger-test.dev` |
| `OP_KEY_ID` | key ID de Developer Keys |
| `OP_PRIVATE_KEY` | contenido de `private.key` (PEM o base64); pégalo tú, no se sube al repo |
| `PUBLIC_API_URL` | URL pública de la API (a donde vuelve la wallet) |
| `FRONTEND_URL` | URL del front (opcional; sin ella el retorno responde JSON) |

La llave pública debe estar publicada en `{OP_CLIENT_WALLET_ADDRESS}/jwks.json`. Con este proveedor el webhook del placeholder responde 404.

## Correo (códigos de acceso)
La API envía por correo los códigos de inicio de sesión, verificación y recuperación de contraseña (`src/mail/index.js`). En producción elige el proveedor así: `MAIL_PROVIDER` (`brevo`, `mailjet` o `resend`) si está definida; si no, el primero con credenciales: **Brevo** (`BREVO_API_KEY`), **Mailjet** (`MAILJET_API_KEY` y `MAILJET_SECRET_KEY`) o **Resend** (`RESEND_API_KEY`). Sin ninguno **no se entregan correos**: el arranque lo avisa en el log y los códigos no se imprimen.

### Gratis y sin dominio propio: Brevo
Plan gratuito de unos 300 correos al día. Solo hace falta verificar un correo remitente (por ejemplo, tu Gmail); no pide dominio. Se usa su API por HTTPS y no SMTP, porque Railway suele bloquear el SMTP saliente en los planes que no son Pro.

1. Crea una cuenta gratuita en https://www.brevo.com.
2. En *Senders, domains & dedicated IPs → Senders*, añade tu correo remitente y confirma el enlace que Brevo te envía.
3. En *SMTP & API → API keys*, crea una clave y cópiala.
4. En las variables del servicio de la API en Railway añade:
   - `BREVO_API_KEY=<la clave>`
   - `MAIL_FROM=Axiom <tu-correo-verificado@gmail.com>` (debe ser exactamente el remitente verificado)

Railway redespliega solo. Los mensajes de Gmail enviados así pueden caer en spam al principio; para producción real conviene un dominio propio.

### Gratis y sin dominio propio: Mailjet (alternativa a Brevo)
Plan gratuito de 200 correos al día (6 000 al mes). También por API HTTPS y también basta con validar un correo remitente.

1. Crea una cuenta gratuita en https://www.mailjet.com.
2. En *Account settings → Senders & domains → Add a sender address*, añade tu correo y confirma el enlace que Mailjet envía.
3. En *Account settings → REST API → API Key Management (Master)*, copia la **API Key** y la **Secret Key**.
4. En las variables del servicio de la API en Railway añade:
   - `MAILJET_API_KEY=<API Key>`
   - `MAILJET_SECRET_KEY=<Secret Key>`
   - `MAIL_FROM=Axiom <tu-correo-validado>` (exactamente el remitente validado)
   - `MAIL_PROVIDER=mailjet` (solo si también tienes `BREVO_API_KEY`)

### Resend
Con un dominio verificado en https://resend.com/domains: `RESEND_API_KEY` y `MAIL_FROM=Axiom <no-reply@tudominio.com>`. Sin dominio, Resend solo permite enviar desde `onboarding@resend.dev` y únicamente al correo de la cuenta de Resend (sirve para pruebas).

### Probar
`POST /api/v1/auth/email-otp/send-verification-otp` con `{"email":"<tu correo>","type":"sign-in"}`. Si el correo no llega, el motivo queda en el log de Railway como `[mail] send failed` (Brevo y Resend devuelven un código y un mensaje claros, por ejemplo remitente no verificado).

## Comprobar el despliegue
```bash
curl https://<dominio>.up.railway.app/api/v1/health   # {"status":"ok"}
```
Si el health responde pero las rutas fallan, revisa en los logs que aparezca `[db] migrations applied`.

## Notas
- Railway marca la configuración como código (`railway.json`) como obsoleta, por eso los ajustes viven en el panel y el comportamiento de arranque va en el `Dockerfile`.
- Las imágenes quedan en el volumen: sobreviven a los redespliegues, pero el servicio no puede tener más de una réplica. Para escalar horizontalmente hay que moverlas a un almacenamiento de objetos.
- El rate limit está en memoria (una instancia). Con varias réplicas hace falta un almacén compartido.
- Para ejecutar el webhook de pagos simulado: `POST /api/v1/payments/webhook/placeholder` con la cabecera `X-Webhook-Secret` (el valor de `PAYMENT_WEBHOOK_SECRET`, visible en el panel de Railway).
