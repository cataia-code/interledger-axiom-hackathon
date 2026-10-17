# Mapa en Lokora

El mapa de Medellín usa Google Maps cuando se configura `GOOGLE_MAPS_API_KEY`; si la clave no está definida o no funciona, carga cartografía real de OpenStreetMap. Ambos proveedores muestran tiendas, filtros, selección de pines y acceso al catálogo.

1. Habilita Maps JavaScript API en Google Cloud y crea una clave de navegador con restricciones por dominio y por API.
2. Define `GOOGLE_MAPS_API_KEY` en el entorno del proceso Node. En desarrollo, también puedes usar `VITE_GOOGLE_MAPS_API_KEY`.
3. Arranca con `npm run dev`. Para producción ejecuta `npm run build` y `npm run preview`.

La configuración de navegador es visible por diseño; usa restricciones de referrer. Las ubicaciones, logos y comercios están en `src/data/shops.js`, en datos de demostración.
