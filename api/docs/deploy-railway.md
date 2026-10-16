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

Opcionales: `RESEND_API_KEY` y `MAIL_FROM` (sin ellos, en producción los códigos por correo solo salen por el log), `COMMISSION_RATE`, `RESERVATION_TTL_MINUTES`.

**Servicio Postgres:** plantilla de PostgreSQL de Railway con su volumen. La extensión `pg_trgm` la crea la migración `0006`.

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
