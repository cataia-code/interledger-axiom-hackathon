# interledger-axiom-hackathon

API REST base de AxiomOpenPayments (Node.js + Express). Vive en `api/`; ejecuta los comandos desde esa carpeta.

## Requisitos
- Node.js >= 20
- npm

## Instalación
```bash
npm install
cp .env.example .env
```

## Scripts
- `npm start`: inicia el servidor
- `npm run dev`: inicia con recarga automática
- `npm run lint`: ESLint
- `npm test`: pruebas (`node --test` + supertest)

## Endpoints

`GET /api/v1/health` responde `{ "status": "ok" }`. El contrato del marketplace (auth, tiendas, pedidos, wallets y `POST /api/v1/orders/:id/pay`) está en [`docs/frontend-context.md`](docs/frontend-context.md). El probador corre en `/demo.html` con el servidor levantado.

Los errores responden `{ "error": { "message", "code" } }`.

## Pagos y datos de ejemplo

`PAYMENT_PROVIDER` en `.env` elige `placeholder` o `openpayments`. Con `openpayments` hacen falta `OP_CLIENT_WALLET_ADDRESS`, `OP_KEY_ID` y la llave (`OP_PRIVATE_KEY` o `OP_PRIVATE_KEY_PATH`). El detalle está en [`.env.example`](.env.example) y en [`docs/openpayments-integration.html`](docs/openpayments-integration.html).

```bash
npm run seed
```

Carga las tiendas de ejemplo. El despliegue está en [`docs/deploy-railway.md`](docs/deploy-railway.md).

## Estructura
`src/{config,middlewares,routes,controllers,services}`, `test/`.

## Base de datos (PostgreSQL + Drizzle)
```bash
npm run db:up        # levanta Postgres con Docker
npm run db:migrate   # aplica las migraciones de drizzle/
```
Tras cambiar la config de `src/auth/index.js`, regenera el esquema con `npm run auth:schema` y luego `npm run db:generate`.
