# AI Usage Disclosure

Divulgación pedida por la [AI Policy](https://interledger.org/hackathon/ai-policy/) de la Open Payment Hackathon. Cubre el trabajo de `payments/` hecho en Cursor. `api/` y `Front/` los lleva el resto del equipo; si usaron otra herramienta, hay que sumarla en este archivo.

## Tools Used

- Cursor, con el modelo Grok, en la carpeta `payments/` y en este documento.

No tenemos a mano el consumo de créditos de esa sesión. Si el plan es de pago, el equipo completa aquí el número que muestre Cursor.

## Where and How We Used AI

### 1. Cliente de Open Payments (`payments/`)

- Se usó Cursor para armar el cliente que recorre un pago en la red de pruebas: incoming payment, quote, grant interactivo y outgoing payment.
- El flujo quedó en `payments/src/pay.ts`, con helpers en `payments/src/lib.ts`.
- `payments/src/wallet.ts`, `payments/src/quote.ts` y `payments/src/incoming.ts` son consultas sueltas. No forman parte del checkout.
- `payments/INTEGRACION.md` describe cómo ese flujo entra en `POST /api/v1/orders/:id/pay` sin convertirse en otro servicio.

### 2. Documentación de la hackathon

- Se usó Cursor para redactar este archivo y `prompts/payments.md`.

## What We Did Ourselves

- Las corridas reales contra la wallet de pruebas, incluida la aprobación en el navegador.
- Las decisiones de producto: no tocar `api/`, no hardcodear wallets de buyer y seller, no meter devoluciones en este flujo, un solo endpoint de cobro, y mostrar el fee en la pantalla que ya existe.
- La revisión de que los nombres coincidan con el backend: `buyer`, `store`, `order`, `payment`, `amount`, `currency`, `debitAmount`.

## Archivos con poco o ningún uso de IA en este trabajo

- `api/`: no se modificó desde `payments/`.
- `Front/`: no se modificó desde `payments/`.

## Prompt Log

Los prompts de esta parte están en `prompts/payments.md`.
