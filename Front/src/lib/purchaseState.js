export function purchaseState(purchase) {
  const status = purchase.status;
  if (status === 'refunded') return { group: 'incomplete', tone: 'neutral', icon: 'arrowLeft', label: 'Reembolsado', description: 'Este pedido figura como reembolsado.' };
  if (status === 'cancelled') return { group: 'incomplete', tone: 'error', icon: 'close', label: 'Cancelado', description: 'Este pedido fue cancelado.' };
  if (['paid', 'preparing', 'completed', 'captured'].includes(status)) return { group: 'paid', tone: 'success', icon: 'check', label: status === 'preparing' ? 'En preparación' : status === 'completed' ? 'Completado' : 'Pagado', description: 'Pago confirmado.' };
  if (['failed', 'rejected', 'cancelled'].includes(purchase.paymentStatus) || ['failed', 'rejected'].includes(status)) return { group: 'incomplete', tone: 'error', icon: 'info', label: 'Pago no completado', description: 'El último intento de pago falló o no fue autorizado.' };
  if (status === 'expired' || (status === 'pending_payment' && Date.parse(purchase.expiresAt) <= Date.now())) return { group: 'incomplete', tone: 'neutral', icon: 'info', label: 'Plazo vencido', description: 'El plazo para pagar este pedido terminó.' };
  if (status === 'pending_payment' || status === 'pending') return { group: 'pending', tone: 'pending', icon: 'wallet', label: 'Pago pendiente', description: purchase.paymentStatus === 'captured' ? 'El pago se está conciliando con el pedido.' : 'La compra todavía no tiene confirmación de pago.' };
  return { group: 'pending', tone: 'neutral', icon: 'info', label: 'Por verificar', description: 'Actualiza para consultar el estado del pedido.' };
}
