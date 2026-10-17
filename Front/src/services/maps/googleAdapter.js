import { loadGoogleMaps } from './loaders';
import { createMarkerElement, markSelected } from './markers';
export async function createGoogleMap(container, shops, onSelect, key, signal) {
  const maps = await loadGoogleMaps(key);
  if (signal?.aborted) throw new DOMException('Map request cancelled', 'AbortError');
  const map = new maps.Map(container, { center: { lat: 6.2442, lng: -75.5812 }, zoom: 12,
    clickableIcons: false, mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    gestureHandling: 'greedy', zoomControlOptions: { position: maps.ControlPosition.RIGHT_CENTER },
  });
  class ShopOverlay extends maps.OverlayView {
    constructor(shop) { super(); this.shop = shop; this.visible = true; this.element = createMarkerElement(shop, onSelect); this.element.classList.add('google-shop-marker'); this.setMap(map); }
    onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.element); maps.OverlayView.preventMapHitsAndGesturesFrom(this.element); }
    draw() { const point = this.getProjection()?.fromLatLngToDivPixel(new maps.LatLng(this.shop.lat, this.shop.lng)); if (point) { this.element.style.left = `${point.x}px`; this.element.style.top = `${point.y}px`; } }
    onRemove() { this.element.remove(); }
    update(visible, selected) { this.element.style.display = visible ? '' : 'none'; this.element.style.zIndex = selected ? '1000' : '1'; markSelected(this.element, selected); }
  }
  const markers = shops.map(shop => new ShopOverlay(shop));
  const bounds = new maps.LatLngBounds();
  shops.forEach(shop => bounds.extend({ lat: shop.lat, lng: shop.lng }));
  map.fitBounds(bounds, { top: 110, bottom: 160, left: 35, right: 35 });
  return { provider: 'Google Maps',
    update(visibleIds, selectedId) { markers.forEach(marker => marker.update(visibleIds.includes(marker.shop.id), marker.shop.id === selectedId)); },
    center() { map.panTo({ lat: 6.2442, lng: -75.5812 }); map.setZoom(13); },
    destroy() { markers.forEach(marker => marker.setMap(null)); maps.event.clearInstanceListeners(map); container.replaceChildren(); },
  };
}
