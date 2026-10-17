/* global document, window */

// Cuenta atrás, aviso a la ventana que abrió el pago y cierre. Si el navegador no deja cerrar (por ejemplo, la ventana no la abrió
// un script, o es un móvil), se muestra el mensaje para cerrarla a mano y el botón de volver a la app.
const { status, order, seconds, appOrigin } = document.body.dataset;
const message = { source: 'lokora-payments', type: 'payment-result', status, orderId: Number(order) || null };

// Mejor esfuerzo: la wallet puede cortar la relación con la ventana de origen. El front debe confirmar siempre con GET /orders/:id.
try {
  window.opener?.postMessage(message, appOrigin || '*');
} catch {
  /* sin ventana de origen */
}
try {
  new BroadcastChannel('lokora-payments').postMessage(message);
} catch {
  /* sin BroadcastChannel */
}

const count = document.getElementById('count');
let left = Number(seconds) || 3;
count.textContent = String(left);
const timer = setInterval(() => {
  left -= 1;
  count.textContent = String(Math.max(left, 0));
  if (left > 0) return;
  clearInterval(timer);
  window.close();
  // Si seguimos aquí, el navegador no dejó cerrar.
  setTimeout(() => {
    document.getElementById('closing').hidden = true;
    document.getElementById('done').hidden = false;
  }, 400);
}, 1000);
