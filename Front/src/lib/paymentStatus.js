// A redirect or an order alone does not prove capture of the provider payment.
export function confirmedOrderPayment(order, payments) {
  if (!['paid', 'preparing', 'completed'].includes(order?.status) || !Array.isArray(payments)) return null;
  return payments.find(payment => payment.status === 'captured') || null;
}
