import { resolveImageURL } from '../api/client';
export function minorToMajor(amount, currency) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('La API devolvió un importe inválido.');
  const scale = new Intl.NumberFormat('es-CO', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  return amount / 10 ** scale;
}
export function normalizeItem(item) {
  const currency = item.currency;
  const photo = [...(item.images || [])].sort((a, b) => a.position - b.position).map(image => resolveImageURL(image.url)).find(Boolean);
  return { ...item, id: String(item.id), shopId: String(item.storeId), categoryId: item.categoryId == null ? null : String(item.categoryId),
    price: minorToMajor(item.finalPriceAmount, currency), originalPrice: minorToMajor(item.priceAmount, currency),
    currency, photo: photo || '', image: '/assets/store-cover-fallback.svg', available: Number(item.available) || 0,
    purchasable: Number(item.available) > 0,
  };
}
