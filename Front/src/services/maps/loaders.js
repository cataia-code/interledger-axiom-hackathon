let leafletPromise;
let googlePromise;
let configPromise;

function script(url, id) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const element = document.createElement('script');
    element.id = id; element.async = true; element.src = url;
    element.onload = resolve;
    element.onerror = () => { element.remove(); reject(new Error('No se pudo cargar el proveedor de mapas')); };
    document.head.appendChild(element);
  });
}
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    if (!document.querySelector('#leaflet-styles')) {
      const link = document.createElement('link');
      link.id = 'leaflet-styles'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    leafletPromise = script('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'leaflet-runtime')
      .then(() => window.L).catch(error => { leafletPromise = null; throw error; });
  }
  return leafletPromise;
}
export function loadGoogleMaps(key) {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!googlePromise) googlePromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Google Maps no respondió')), 10000);
    window.lokoraGoogleReady = () => { clearTimeout(timer); resolve(window.google.maps); };
    window.gm_authFailure = () => { clearTimeout(timer); window.dispatchEvent(new Event('lokora:google-auth-failure')); reject(new Error('Clave de Google Maps no válida')); };
    script(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=lokoraGoogleReady&loading=async&v=weekly`, 'google-maps-runtime')
      .catch(error => { clearTimeout(timer); reject(error); });
  }).catch(error => { googlePromise = null; throw error; });
  return googlePromise;
}
export function getMapConfig() {
  if (!configPromise) configPromise = fetch('/api/config').then(response => response.ok ? response.json() : {})
    .catch(() => ({})).then(config => ({ googleMapsApiKey: config.googleMapsApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '' }));
  return configPromise;
}
