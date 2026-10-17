export const couponStates = { available: 'Disponible', used: 'Usado', exhausted: 'Agotado', expired: 'Vencido', upcoming: 'Próximamente', paused: 'Pausado' };
const messages = {
  COUPON_NOT_FOUND: 'No encontramos un cupón válido para esta tienda.',
  COUPON_NOT_ELIGIBLE: 'Guarda primero este cupón en tu cartera.',
  COUPON_WRONG_STORE: 'Este cupón pertenece a otra tienda. Tu carrito no se ha modificado.',
  COUPON_PAUSED: 'Este cupón está pausado.',
  COUPON_NOT_STARTED: 'Este cupón todavía no está vigente.',
  COUPON_EXPIRED: 'Este cupón ha vencido.',
  COUPON_USER_LIMIT: 'Ya alcanzaste el límite de usos de este cupón.',
  COUPON_EXHAUSTED: 'Este cupón ya no tiene usos disponibles.',
  COUPON_MIN_NOT_MET: 'Tu compra no alcanza el mínimo requerido por el cupón.',
  COUPON_NOT_APPLICABLE: 'Los productos de tu carrito no aplican a este cupón.',
};
export const couponMessage = (code, fallback) => messages[code] || fallback || 'No pudimos aplicar el cupón. Revisa sus condiciones.';
