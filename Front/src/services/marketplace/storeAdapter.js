import { categoryIcons } from '../../data/categories';

// Adapt the API's store representation here, keeping screens independent of transport details.
export function normalizeStore(store) {
  return {
    ...store,
    categoryIcon: store.categoryIcon || categoryIcons[store.category] || 'shop',
    type: store.type || store.category || 'Comercio local',
    logo: store.logo || '/assets/store-logo-fallback.svg',
    cover: store.cover || '/assets/store-cover-fallback.svg',
    area: store.area || store.city || 'Ubicación no disponible',
    distance: store.distance || store.city || 'Distancia no disponible',
    rating: Number(store.rating) || 0,
    reviews: Number(store.reviews) || 0,
    price: Number(store.price) || 0,
    products: (store.products || []).map(product => ({ ...product, price: Number(product.price) || 0 })),
  };
}
