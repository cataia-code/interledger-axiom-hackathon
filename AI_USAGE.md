# AI Usage Disclosure

Divulgación pedida por la [AI Policy](https://interledger.org/hackathon/ai-policy/) de la Open Payment Hackathon. Cubre el trabajo de `payments/` hecho en Cursor y los cambios de `api/` hechos con Claude Code que se listan abajo. `Front/` lo lleva el resto del equipo; si usaron otra herramienta, hay que sumarla en este archivo.

## Tools Used

- Cursor, con el modelo Grok, en la carpeta `payments/` y en este documento.
- Claude Code (CLI de Anthropic), con el modelo Claude Sonnet 5.5, en la carpeta `api/`: código, pruebas, documentación y scripts.
- Claude in Chrome (extensión de Anthropic que maneja el navegador de la persona), para abrir pull requests en GitHub y configurar Railway desde su panel.

No tenemos a mano el consumo de créditos de esas sesiones. Si el plan es de pago, el equipo completa aquí el número que muestre cada herramienta.

## Where and How We Used AI

### 1. Cliente de Open Payments (`payments/`)

- Se usó Cursor para armar el cliente que recorre un pago en la red de pruebas: incoming payment, quote, grant interactivo y outgoing payment.
- El flujo quedó en `payments/src/pay.ts`, con helpers en `payments/src/lib.ts`.
- `payments/src/wallet.ts`, `payments/src/quote.ts` y `payments/src/incoming.ts` son consultas sueltas. No forman parte del checkout.
- `payments/INTEGRACION.md` describe cómo ese flujo entra en `POST /api/v1/orders/:id/pay` sin convertirse en otro servicio.

### 2. API REST (`api/`), con Claude Code

Solo cubre lo que se pidió en esta sesión de trabajo. El resto de `api/` (marketplace, autenticación, pagos) lo escribió el equipo y no está en esta lista.

**Código y pruebas**
- `GET /stores`: listado público de tiendas activas con filtros `q` y `city` y paginación por cursor, con su prueba.
- Imágenes de tienda: banner (1600×600) e icono circular (256×256) con `PUT` y `DELETE` en `/seller/store/banner` y `/seller/store/icon`, y los campos `bannerUrl` e `iconUrl` en las respuestas de tienda. Migración `0010`.
- Almacenamiento de imágenes en un bucket compatible con S3 (Railway Bucket), con respaldo en disco: `api/src/storage/`, y `GET /uploads/*` sirve los archivos desde el bucket. Pruebas con un cliente S3 simulado y de recorrido de rutas.
- País de origen del usuario (`country` y `countryName`): se acepta en el registro de comprador y vendedor, se devuelve en el login y en `/me`, y se edita con `PATCH /me`. Acepta el código ISO o el nombre del país, solo los 249 países oficiales, y se añadió `GET /countries`. Migración `0011`.
- Cada cambio se probó con `npm test` (105 pruebas al cierre de esta parte) y `eslint`, y se corrió contra una base de datos limpia antes de subirlo.

**Herramientas de apoyo**
- Probador web de la API en `api/src/public/` (`/demo.html`): elegir endpoint, token opcional, cuerpo JSON y respuesta resaltada.
- Seed `api/scripts/seed.js` (`npm run seed`): tiendas de Medellín con ítems, banner, icono y tres imágenes por producto generadas con `sharp`, no fotos reales. Funciona contra local o Railway y se puede repetir sin duplicar.

**Documentación**
- `api/docs/frontend-context.md`: contexto de endpoints, tipos y flujos para el agente que trabaja el frontend.
- `api/docs/auth-flow.html`: diagrama del registro y el inicio de sesión.
- Una página con los endpoints nuevos y modificados, publicada como artifact de Claude (no está en el repositorio).
- Ajustes en `api/docs/deploy-railway.md` para el bucket y sus variables.

**Operación en Railway y GitHub, con Claude in Chrome y Claude Code**
- Se creó el Bucket `recorded-basket` y se añadieron al servicio de la API las variables `S3_*` como referencias, sin copiar secretos.
- Se corrió el seed contra la API desplegada y se borraron, por los endpoints de la propia API, las tiendas e ítems del seed anterior.
- Los pull requests #13, #14 y #16 se abrieron desde el navegador con Claude in Chrome. Los anteriores de la rama `feature/api-demo-page` (probador, `GET /stores` y seed) los abrió una persona del equipo con un enlace preparado por Claude Code. Ningún pull request lo mergeó la IA: los mergeó y desplegó una persona del equipo.

### 3. Documentación de la hackathon

- Se usó Cursor para redactar este archivo y `prompts/payments.md`.
- Se usó Claude Code para ampliar este archivo con la parte de `api/`.

## What We Did Ourselves

- Las corridas reales contra la wallet de pruebas, incluida la aprobación en el navegador.
- Las decisiones de producto: no tocar `api/`, no hardcodear wallets de buyer y seller, no meter devoluciones en este flujo, un solo endpoint de cobro, y mostrar el fee en la pantalla que ya existe.
- La revisión de que los nombres coincidan con el backend: `buyer`, `store`, `order`, `payment`, `amount`, `currency`, `debitAmount`.
- En `api/`: qué construir y con qué alcance (listado de tiendas, imágenes de tienda y de producto, país del usuario), usar un bucket y no el disco, dejar el seed en 3 tiendas con 5 ítems en Medellín, aceptar el país por nombre y no solo por código, y qué datos borrar en Railway.
- En `api/`: decidir qué se mergea y cuándo, hacer los despliegues en Railway, poner los secretos y las variables propias (llaves y wallets de Open Payments), y la revisión final de cada pull request.

## Archivos con poco o ningún uso de IA en este trabajo

- `api/`: `payments/` no lo modificó. Los cambios de `api/` con IA son los de la sección 2; el resto lo escribió el equipo.
- `Front/`: no se modificó desde `payments/` ni desde Claude Code.

## Prompt Log

Las instrucciones de `payments/` están en `prompts/payments.md`, redactadas de nuevo a partir de lo pedido.

Para `api/`, las peticiones fueron conversacionales y no se guardó el texto literal. Resumidas:
- Revisar si la API de Railway responde y dar una forma de probarla desde un HTML para compartir en el equipo.
- Mostrar cómo probar en local con CORS y cómo usar la llave privada en Railway sin subirla al repositorio.
- Rediseñar el probador: más cuidado visual, endpoint a elección, token opcional y un indicador de carga.
- Añadir `GET /stores` con pruebas y reflejarlo en el probador.
- Preparar un documento de contexto de la API para el agente del frontend, y un diagrama del registro y el login.
- Crear datos de ejemplo: tiendas en Medellín, luego 3 tiendas con 5 ítems cada una, y correrlos en Railway.
- Añadir banner e icono de tienda y tres imágenes por producto, guardadas en un bucket, y configurar el bucket en Railway.
- Añadir el país de origen al registro y al perfil, aceptarlo por nombre y listar los países.
- Preparar un HTML con solo los endpoints que cambiaron y publicarlo como artifact.
- Hacer commit, push y pull request de cada cambio.
