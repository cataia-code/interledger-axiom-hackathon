// Illustrative data only. These are never substituted for failed API requests.
export const marketplaceStatsExample = { stats: { stores: 3, items: 18, orders: 72, users: 45, topStores: [] } };
export const storeStatsPreviewStore = { id: '4', name: 'Panadería El Poblado', description: 'Tienda de ejemplo', city: 'Medellín', currency: 'COP', logo: '/assets/store-logo-fallback.svg' };
export function storeStatsExample(storeId) {
  return { storeId, score: 81, stars: 4.0, level: 'gold', confidence: 'high',
    breakdown: { catalog: 21.0, sales: 33.7, reliability: 17.3, activity: 8.8 },
    metrics: { activeItems: 8, ordersCompleted: 24, completionRate: 0.89, unitsSold: 61, uniqueBuyers: 15, ordersLast30d: 9 } };
}
