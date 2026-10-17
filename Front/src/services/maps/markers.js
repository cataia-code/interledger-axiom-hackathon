import { money } from '../../lib/currency';

// DOM elements belong to the map provider; application UI remains in React components.
export function createMarkerElement(shop, onSelect) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'shop-map-pin';
  button.setAttribute('aria-label', `Ver ${shop.name}`);
  button.setAttribute('aria-pressed', 'false');
  const logo = document.createElement('img');
  logo.src = shop.logo; logo.alt = ''; logo.width = 40; logo.height = 40;
  const price = document.createElement('span');
  price.className = 'shop-map-pin__price'; price.textContent = shop.price > 0 ? money(shop.price, shop.currency || 'COP') : 'Nueva tienda';
  button.append(logo, price);
  button.addEventListener('click', event => { event.stopPropagation(); onSelect(shop.id); });
  return button;
}
export function markSelected(element, selected) {
  element.classList.toggle('is-selected', selected);
  element.setAttribute('aria-pressed', String(selected));
}
