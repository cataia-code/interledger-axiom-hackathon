# Lokora

Prototipo de la app para el viajero y para la tienda: mapa, catálogo, wallet y la pantalla de pago. El cobro que cotiza y pide aprobación en la wallet de test de Interledger vive en `api/`.

## Desarrollo

Requiere Node.js 22.12 o superior. Desde esta carpeta:

```bash
npm install
npm run dev
```

La app queda en `http://127.0.0.1:3000`. El puerto por defecto es `3000`, el mismo de la API. Si las dos corren en local, arranca esta con otro puerto: `PORT=3001 npm run dev`.

- `npm run build`: genera la versión de producción en `dist/`.
- `npm run preview`: sirve la versión compilada. Antes hace falta `npm run build`.
- El mapa está en [`MAPS.md`](MAPS.md). Usa `GOOGLE_MAPS_API_KEY`; si falta, carga OpenStreetMap.

## Datos

Por defecto la app lee tiendas, cupones y saldos de `src/data/`. Para hablar con la API:

```bash
VITE_DATA_SOURCE=api VITE_API_BASE_URL=http://localhost:3000/api/v1 npm run dev
```

`VITE_API_BASE_URL` es la base de la API, con `/api/v1`. En el despliegue de prueba esa base es `https://interledger-axiom-hackathon-production.up.railway.app/api/v1`.

La pantalla de pago muestra el monto y la conversión antes de confirmar. El cobro que crea la cotización y abre la aprobación está en `POST /api/v1/orders/:id/pay`.

## Código fuente

```text
src/
  app/               enrutamiento de pantallas
  components/        layout, UI, tiendas, mapas y gráficas
  context/           wallet, carrito, favoritos y navegación
  data/              tiendas, cupones y datos del prototipo
  hooks/             navegación, cámara y estado del mapa
  pages/             pantallas de viajero e interfaz del vendedor
  services/maps/     adaptación para Google Maps y OpenStreetMap
  services/api/      cliente HTTP y datos locales
  styles/            tokens globales y transiciones
```

## Conexión a Axiom API

El modo API está activo en `.env.local`. Usa `VITE_DATA_SOURCE=api`, `VITE_API_BASE_URL=/api/v1` y `AXIOM_API_ORIGIN=https://interledger-axiom-hackathon-production.up.railway.app`. El servidor Node reenvía las llamadas al backend, sin una solicitud cross-origin del navegador. Para usar únicamente datos de ejemplo, cambia a `VITE_DATA_SOURCE=mock` y reinicia el servidor. Las peticiones del navegador van al mismo origen de Lokora; Node reenvía las llamadas a Axiom.

Registro de comprador y vendedor separado, login con contraseña o código OTP, verificación opcional de correo, recuperación de sesión con `/me` y cierre de sesión remoto. El login identifica el rol desde las respuestas del servidor; no solicita elegirlo de nuevo. Todas las pantallas internas requieren sesión.

La app consume catálogo, carrito y pedidos. El checkout de API ya prepara la autorización con Open Payments: muestra los importes receive/debit/fee devueltos por el servidor, abre redirectUrl en otra pestaña y confirma captured en los pagos del pedido, además del estado pagado. La moneda de débito viene del proveedor (por ejemplo EUR) y no se fija a USD. No se muestran saldos de cuenta. En modo mock, la conversión y la conexión de wallet son simulaciones.

`src/services/auth`, `src/services/marketplace`, `src/services/cart`, `src/services/orders` y `src/services/payments` aíslan el transporte y los formatos del backend. Las contraseñas no se almacenan; el token opaco y el rol se mantienen en la sesión de la pestaña.

Detalles del contrato, límites y funciones pendientes en [docs/API-CONTRACT.md](docs/API-CONTRACT.md).

## Prueba de idiomas

El interruptor con banderas de Colombia (ES) y Estados Unidos (EN) aparece arriba en bienvenida, acceso y la cabecera de la app. Antes de una selección manual, detecta el idioma automáticamente. La prioridad es selección manual (guardada en este navegador), futuro `user.locale` de `/me`, idioma compatible del navegador y, finalmente, español. El campo propuesto acepta etiquetas como `es-CO` o `en-US`; todavía no se guarda una preferencia en el backend.

La prueba usa diccionarios locales en `src/i18n/` y `Intl` para números y fechas. No se pudo descargar `i18next` por un problema de resolución DNS de npm; no está instalado. Las pantallas principales tienen traducciones ES/EN, con español como respaldo para textos pendientes. El contenido del catálogo y los mensajes originales del backend no se traducen automáticamente. El idioma no cambia la moneda ni convierte los importes.
