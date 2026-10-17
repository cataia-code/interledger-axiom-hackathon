import { loadLeaflet } from './loaders';
import { createMarkerElement, markSelected } from './markers';
const center = [6.2442, -75.5812];
export async function createLeafletMap(container, shops, onSelect, signal) {
  const L = await loadLeaflet();
  if (signal?.aborted) throw new DOMException('Map request cancelled', 'AbortError');
  const map = L.map(container, { zoomControl: false, scrollWheelZoom: true }).setView(center, 12);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>', maxZoom: 19,
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const markers = shops.map(shop => {
    const element = createMarkerElement(shop, onSelect);
    L.DomEvent.disableClickPropagation(element);
    const icon = L.divIcon({ className: 'lokora-map-marker', html: element, iconSize: [48, 60], iconAnchor: [24, 52] });
    const marker = L.marker([shop.lat, shop.lng], { icon, keyboard: false, title: shop.name }).addTo(map);
    return { id: shop.id, marker, element };
  });
  map.fitBounds(L.latLngBounds(shops.map(shop => [shop.lat, shop.lng])), { paddingTopLeft: [35, 105], paddingBottomRight: [35, 160], maxZoom: 13 });
  const resize = new ResizeObserver(() => map.invalidateSize());
  resize.observe(container);
  return {
    provider: 'OpenStreetMap',
    update(visibleIds, selectedId) {
      markers.forEach(({ id, marker, element }) => {
        if (visibleIds.includes(id)) { if (!map.hasLayer(marker)) marker.addTo(map); } else marker.remove();
        markSelected(element, id === selectedId);
        marker.setZIndexOffset(id === selectedId ? 1000 : 0);
      });
    },
    center() { map.setView(center, 13, { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches }); },
    destroy() { resize.disconnect(); tiles.off(); map.remove(); },
  };
}
