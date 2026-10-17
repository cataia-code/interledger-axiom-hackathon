# Mapa en Lokora

El mapa de Medellín usa Google Maps cuando se configura `GOOGLE_MAPS_API_KEY`; si la clave no está definida o no funciona, carga cartografía real de OpenStreetMap. Ambos proveedores muestran tiendas, filtros, selección de pines y acceso al catálogo.

1. Habilita Maps JavaScript API en Google Cloud y crea una clave de navegador con restricciones por dominio y por API.
2. Define `GOOGLE_MAPS_API_KEY` en el entorno del proceso Node. En desarrollo, también puedes usar `VITE_GOOGLE_MAPS_API_KEY`.
3. Arranca con `npm run dev`. Para producción ejecuta `npm run build` y `npm run preview`.

La configuración de navegador es visible por diseño; usa restricciones de referrer. Las ubicaciones, logos y comercios están en `src/data/shops.js`, en datos de demostración.

## Tiendas cerca de mí

El mapa abre mostrando las tiendas disponibles de la ciudad sin solicitar ubicación automáticamente. Cerca de mí solicita geolocalización solo al tocarlo (HTTPS o localhost), muestra el marcador del usuario y filtra las tiendas con coordenadas válidas a 8 km usando distancia geográfica aproximada, no una ruta de viaje. La ficha muestra la distancia a la tienda.

Si no se concede el permiso o falla la ubicación, se conserva el mapa completo con un aviso. Si no hay tiendas en el radio y filtros actuales, se informa sin presentar tiendas lejanas como cercanas. Ver toda la ciudad quita el filtro de proximidad y restaura el encuadre. La ubicación permanece en memoria durante esta vista; no se guarda ni se envía al backend de Lokora. Los proveedores de mapas reciben el área del mapa al centrarlo. Compatible con Google Maps y el fallback de Leaflet.
