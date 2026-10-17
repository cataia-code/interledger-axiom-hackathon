# Lokora

Prototipo de app móvil para turismo, comercio local y pagos de demostración.

## Desarrollo

Requiere Node.js 22.12 o superior. Ejecuta `npm install` una sola vez y `npm run dev` para levantar la aplicación en `http://127.0.0.1:3000`.

- `npm run build`: genera la versión de producción en `dist/`.
- `npm run preview`: sirve la versión compilada localmente.
- `GOOGLE_MAPS_API_KEY`: clave de navegador limitada por dominio y Maps JavaScript API; OpenStreetMap sirve como alternativa si falta la clave.

## Código fuente

```text
src/
  app/               enrutamiento de pantallas
  components/        layout, UI, tiendas, mapas y gráficas
  context/           autenticación, carrito, compras y navegación
  data/              tiendas, cupones y datos de demostración
  hooks/             navegación, cámara y estado del mapa
  pages/             pantallas de viajero e interfaz del vendedor
  services/maps/     adaptación para Google Maps y OpenStreetMap
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
