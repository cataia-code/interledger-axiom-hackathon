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
- `GET /api/v1/health` → `{ "status": "ok" }`
- `GET /api/v1/ping` → `{ "message": "pong", "count": n }`

Los errores responden `{ "error": { "message", "code" } }`.

## Estructura
`src/{config,middlewares,routes,controllers,services}`, `test/`.

## Base de datos (PostgreSQL + Drizzle)
```bash
npm run db:up        # levanta Postgres con Docker
npm run db:migrate   # aplica las migraciones de drizzle/
```
Tras cambiar la config de `src/auth/index.js`, regenera el esquema con `npm run auth:schema` y luego `npm run db:generate`.
