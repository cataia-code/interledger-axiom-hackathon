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
