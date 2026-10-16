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

## Correo con Resend
La API envía por correo los códigos de inicio de sesión, verificación y recuperación de contraseña (`src/mail/index.js`). En producción usa Resend si existe `RESEND_API_KEY`; si no, **no se entregan correos** y el arranque lo avisa en el log (el código no se imprime en producción).

1. En https://resend.com/api-keys crea una clave con permiso **Sending access** y cópiala (se muestra una sola vez).
2. En Railway, en las variables del servicio de la API, añade `RESEND_API_KEY=<la clave>`. Railway redespliega solo.
3. `MAIL_FROM` (opcional, por defecto `Axiom <onboarding@resend.dev>`):
   - **Sin dominio verificado**, Resend solo permite enviar desde `onboarding@resend.dev` y únicamente a la dirección del dueño de la cuenta de Resend. Sirve para probar.
   - **Con dominio propio**: en https://resend.com/domains añade el dominio, crea en tu DNS los registros que indica (SPF, DKIM) y espera a que figure como *Verified*. Después define `MAIL_FROM=Axiom <no-reply@tudominio.com>`.
4. Prueba: `POST /api/v1/auth/email-otp/send-verification-otp` con `{"email":"<tu correo>","type":"sign-in"}` y revisa https://resend.com/emails (cada envío aparece con su estado) y el buzón. Si el correo no llega, el error de Resend queda en el log de Railway como `[mail] send failed`.

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
