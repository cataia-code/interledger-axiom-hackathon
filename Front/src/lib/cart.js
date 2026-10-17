export function groupCart(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.shopId)) groups.set(item.shopId, { shopId: item.shopId, currency: item.currency || 'COP', items: [], total: 0, quantity: 0 });
    const group = groups.get(item.shopId);
    const existing = group.items.find(line => line.id === item.id);
    if (existing) existing.quantity += 1;
    else group.items.push({ ...item, quantity: 1 });
    group.total += item.price;
    group.quantity += 1;
  }
  return [...groups.values()];
}
export function changeQuantity(items, shopId, productId, quantity) {
  const product = items.find(item => item.shopId === shopId && item.id === productId);
  if (!product) return items;
  const next = items.filter(item => item.shopId !== shopId || item.id !== productId);
  const count = Math.max(0, Math.min(99, Math.trunc(quantity)));
  return [...next, ...Array.from({ length: count }, () => ({ ...product }))];
}
