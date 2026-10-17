# Lokora

<p>
  <a href="https://developer.mozilla.org/docs/Web/JavaScript"><img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white"></a>
  <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB"></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white"></a>
  <a href="https://expressjs.com/"><img alt="Express" src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white"></a>
  <a href="https://www.postgresql.org/"><img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white"></a>
  <a href="https://openpayments.dev/"><img alt="Open Payments" src="https://img.shields.io/badge/Open_Payments-6C47FF?style=flat-square"></a>
  <a href="https://wallet.interledger-test.dev/"><img alt="Red de pruebas" src="https://img.shields.io/badge/red_de_pruebas-dinero_de_juego-2ea44f?style=flat-square"></a>
</p>

Lokora es un mercado para el comercio de barrio. Un visitante paga desde la wallet que ya tiene y la tienda recibe en su moneda, por Open Payments, en la red de pruebas de Interledger. El dinero de esa red es de juego.

## 🏪 Para quién

Para la tienda de Medellín que hoy cobra en efectivo o por una app local, y para quien llega de otro país y no tiene cuenta en pesos. El comprador no abre un banco nuevo para una arepa. La tienda no monta un datáfono internacional para un cliente que pasa una vez.

## 💸 Por qué se necesita

Ese cruce se cae en el mostrador. La tarjeta extranjera cobra de más, el efectivo obliga a cambiar moneda y la app local no ve la cuenta del visitante. La tienda deja la venta. El visitante no tiene cómo pagar algo pequeño sin fricción. Lokora junta las dos cuentas en un solo cobro y muestra, antes de aprobar, cuánto sale y cuánto llega.

## 🔗 Qué lo hace posible

Open Payments es un estándar, no una pasarela propia. El backend firma como cliente y le pide a cada entidad que mueva el dinero de su cuenta. La wallet de cada persona es una URL que se guarda una vez. En pruebas, esa entidad es [wallet.interledger-test.dev](https://wallet.interledger-test.dev). La cotización dice el débito en la moneda de quien paga y el abono en la moneda de la tienda. La diferencia es el fee de la red. La comisión de Lokora va aparte, en el pedido, y no se gira con ese cobro.

## 🔄 Cómo funciona el dinero

1. La tienda y el comprador vinculan su wallet. Una queda como principal.
2. El comprador arma el pedido. El monto y la moneda salen de la tienda.
3. `POST /api/v1/orders/:id/pay` crea la factura en la wallet de la tienda, cotiza y prepara la aprobación.
4. La respuesta trae lo que llega, lo que sale, el fee cuando las dos monedas coinciden, y `redirectUrl`.
5. La persona abre esa URL y aprueba en su entidad. Ese es el único paso fuera de la app.
6. La wallet vuelve al backend. El pedido queda pagado solo si llegó el monto cotizado.

El dinero sale de la wallet del comprador y entra en la wallet principal de quien dueña la tienda. Un cobro tiene un solo receptor.

## 🗺️ Flujos y diagramas

El recorrido del cobro, las wallets y la aprobación están dibujados en la [documentación del proyecto](https://claude.ai/artifact/MJMcf52BZ8kfVK3NnZL21B).

## ✨ Por qué ahora

Hasta hace poco, cobrarle a alguien de otra entidad pedía un convenio por banco. Open Payments deja que la misma app hable con cualquiera que implemente el estándar: se cotiza la tasa en el momento, se muestra el fee y se aprueba una sola vez. La red de pruebas ya permite recorrerlo de punta a punta, con wallets en monedas distintas, sin mover dinero real.

## 📦 Repo

| | |
|---|---|
| `Front/` | Prototipo en React. Ver `Front/README.md`. |
| `api/` | API en Node.js y Express, con PostgreSQL. Ver `api/README.md`. |
| `payments/` | Cliente en TypeScript del mismo cobro. Ver `payments/README.md` y `payments/INTEGRACION.md`. |
| `AI_USAGE.md` | Divulgación de uso de IA pedida por la hackathon. |

## 👥 Equipo

[Axiom](https://github.com/cataia-code/interledger-axiom-hackathon). Proyecto de la [Open Payment Hackathon](https://interledger.org/hackathon/2026-hackathon-medellin/), Medellín, 16 y 17 de octubre de 2026.

## 📄 Licencia

El código de Lokora está bajo la [Apache License 2.0](LICENSE). © 2026 Axiom.

Las dependencias conservan la suya:

- **MIT.** Node.js, React, React DOM, Vite, Express, better-auth, pg, cors, helmet, multer, pino, resend, express-rate-limit, ESLint y Drizzle Kit.
- **Apache 2.0.** `@interledger/open-payments`, TypeScript, Drizzle ORM, Sharp y `@aws-sdk/client-s3`.
- **BSD 2-Clause.** dotenv.
- **PostgreSQL License.** El motor de la base de datos.

## 🙏 Reconocimientos

[Open Payments](https://openpayments.dev/) e [Interledger](https://interledger.org/).
