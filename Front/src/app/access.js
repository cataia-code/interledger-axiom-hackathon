const publicRoutes = new Set(['welcome', 'login', 'register']);
export const isPublicRoute = route => publicRoutes.has(route);
export const isMerchantRoute = route => ['createStore', 'seller', 'sellerProduct', 'sellerCoupons', 'stats', 'scheduled', 'settings'].includes(route);

export const isBuyerRoute = route => ['cart', 'payment', 'paymentReturn', 'scanner', 'success', 'wallet', 'coupons', 'impact', 'impactDetail'].includes(route);
