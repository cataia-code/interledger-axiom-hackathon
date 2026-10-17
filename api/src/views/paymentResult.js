// Página que ve la persona al volver de la wallet. Mismo diseño que el front de Lokora (crema, azul marino, verde azulado,
// Inter y Poppins) y autónoma: no depende del front. Su script (/payment-result.js) cuenta 3 segundos, avisa a la ventana
// que abrió el pago y cierra esta ventana; si el navegador no la deja cerrar, muestra cómo seguir.

const ICONS = {
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M12 7v6.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/><path d="M12 3.5l9 15.5H3z"/>',
};

const VIEWS = {
  paid: { tone: 'ok', icon: 'check', eyebrow: 'GRACIAS POR COMPRAR LOCAL', title: 'Pago exitoso', text: 'Tu pago se confirmó y tu pedido quedó pagado.', seconds: 3 },
  denied: { tone: 'bad', icon: 'cross', eyebrow: 'PAGO CANCELADO', title: 'Pago declinado', text: 'No aprobaste el pago en tu wallet, así que no se cobró nada.', seconds: 3 },
  failed: { tone: 'bad', icon: 'cross', eyebrow: 'NO SE COMPLETÓ', title: 'No se pudo completar el pago', text: 'El pago no se completó. Tu pedido sigue pendiente y puedes intentarlo de nuevo.', seconds: 3 },
  processing: { tone: 'wait', icon: 'clock', eyebrow: 'EN PROCESO', title: 'Estamos confirmando tu pago', text: 'Vuelve a la app: ahí verás el resultado en unos segundos.', seconds: 3 },
};

const ERRORS = {
  QUOTE_EXPIRED: ['La cotización venció', 'Tardaste más del tiempo permitido. Vuelve a la app y paga de nuevo.'],
  INVALID_INTERACTION_HASH: ['No pudimos verificar el pago', 'La confirmación de tu wallet no es válida. Vuelve a la app e inténtalo de nuevo.'],
  NO_PENDING_SESSION: ['No hay un pago pendiente', 'Este pago ya se procesó o no existe. Revisa tu pedido en la app.'],
  ORDER_NOT_FOUND: ['No encontramos el pedido', 'Revisa tus pedidos en la app.'],
  PAYMENT_PROVIDER_ERROR: ['La wallet no respondió', 'No pudimos confirmar el pago con la red. Revisa el estado de tu pedido en la app antes de intentar de nuevo.'],
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function resultView(status, code) {
  if (status !== 'error') return VIEWS[status] ?? VIEWS.failed;
  const [title, text] = ERRORS[code] ?? ['No pudimos completar el pago', 'Revisa el estado de tu pedido en la app.'];
  return { tone: 'bad', icon: 'alert', eyebrow: 'ALGO SALIÓ MAL', title, text, seconds: 6 };
}

// `status`: paid | denied | failed | processing | error. `appUrl`: a dónde vuelve la persona si no se puede cerrar la ventana.
export function renderPaymentResult({ status, orderId = null, orderNumber = null, code = null, appUrl = null, appOrigin = '' }) {
  const view = resultView(status, code);
  const reference = orderNumber ?? (orderId ? `#${orderId}` : null);
  const back = appUrl ? `<a class="button" href="${escapeHtml(appUrl)}">Volver a la app</a>` : '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex">
<title>${escapeHtml(view.title)} · Lokora</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root { --cream: #f8f4e7; --paper: #fffdf7; --navy: #1e3a52; --wine: #a12d4a; --teal: #2e7d73; --gold: #b8860b; --muted: #687879; --line: #e9e2d5; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: var(--cream); color: var(--navy); font-family: Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  main { width: 100%; max-width: 400px; background: var(--paper); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 5px 18px #1e3a520c; padding: 36px 28px 28px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .brand { font: 700 20px/1 Poppins, system-ui, sans-serif; letter-spacing: -0.01em; color: var(--navy); margin-bottom: 14px; }
  .brand span { color: var(--teal); }
  .icon { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; margin-bottom: 10px; }
  .icon svg { width: 40px; height: 40px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
  .ok .icon { background: #2e7d7314; color: var(--teal); }
  .bad .icon { background: #a12d4a14; color: var(--wine); }
  .wait .icon { background: #f0b42926; color: var(--gold); }
  .eyebrow { font-size: 10px; letter-spacing: 1.25px; font-weight: 700; color: var(--muted); }
  h1 { margin: 0; font: 600 25px/1.25 Poppins, system-ui, sans-serif; }
  p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--muted); max-width: 32ch; }
  .ref { margin-top: 6px; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--cream); }
  .closing { margin-top: 14px; font-size: 13px; font-weight: 500; color: var(--navy); }
  .closing b { display: inline-block; min-width: 1ch; font-variant-numeric: tabular-nums; color: var(--teal); }
  .bad .closing b { color: var(--wine); }
  .done { margin-top: 14px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .done p { font-size: 13px; }
  .button { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 20px; border-radius: 12px; background: var(--teal); color: #fff; font: 600 13px/1.3 Inter, system-ui, sans-serif; text-decoration: none; }
  .button:hover { box-shadow: 0 5px 15px #1e3a5217; }
  [hidden] { display: none !important; }
</style>
</head>
<body data-status="${escapeHtml(status)}" data-order="${escapeHtml(orderId ?? '')}" data-seconds="${view.seconds}" data-app-origin="${escapeHtml(appOrigin)}">
<main class="${view.tone}">
  <div class="brand">Lokora<span>.</span></div>
  <div class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[view.icon]}</svg></div>
  <span class="eyebrow">${escapeHtml(view.eyebrow)}</span>
  <h1>${escapeHtml(view.title)}</h1>
  <p>${escapeHtml(view.text)}</p>
  ${reference ? `<span class="ref">Pedido ${escapeHtml(reference)}</span>` : ''}
  <div class="closing" id="closing" role="status">Esta ventana se cerrará en <b id="count">${view.seconds}</b> s</div>
  <div class="done" id="done" hidden>
    <p>Ya puedes cerrar esta ventana y volver a la app.</p>
    ${back}
  </div>
</main>
<noscript><style>#closing { display: none; } #done { display: flex !important; }</style></noscript>
<script src="/payment-result.js"></script>
</body>
</html>`;
}
