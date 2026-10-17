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
  context/           wallet, carrito, favoritos y navegación
  data/              tiendas, cupones y datos de demostración
  hooks/             navegación, cámara y estado del mapa
  pages/             pantallas de viajero e interfaz del vendedor
  services/maps/     adaptación para Google Maps y OpenStreetMap
  styles/            tokens globales y transiciones
```

Los saldos, tipo de cambio, pagos y panel del vendedor son simulaciones; no mueven dinero real.
