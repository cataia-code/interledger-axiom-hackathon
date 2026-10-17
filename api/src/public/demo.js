/* global document, location, Option */

// Catálogo de endpoints conocidos (el campo de ruta sigue siendo editable).
const GROUPS = {
  General: [
    ['GET', '/api/v1/health'],
    ['GET', '/api/v1/ping'],
  ],
  'Auth comprador': [
    ['POST', '/api/v1/auth/buyer/sign-up', { name: '', email: '', password: '' }],
    ['POST', '/api/v1/auth/buyer/sign-in', { email: '', password: '' }],
    ['POST', '/api/v1/auth/buyer/sign-in/otp', { email: '', otp: '' }],
  ],
  'Auth vendedor': [
    ['POST', '/api/v1/auth/seller/sign-up', { name: '', email: '', password: '' }],
    ['POST', '/api/v1/auth/seller/sign-in', { email: '', password: '' }],
    ['POST', '/api/v1/auth/seller/sign-in/otp', { email: '', otp: '' }],
  ],
  Catálogo: [
    ['GET', '/api/v1/items'],
    ['GET', '/api/v1/items/:id'],
    ['GET', '/api/v1/stores/:id'],
    ['GET', '/api/v1/stores/:id/categories'],
  ],
  Cuenta: [
    ['GET', '/api/v1/me'],
    ['PATCH', '/api/v1/me', {}],
  ],
  'Comprador (token)': [
    ['GET', '/api/v1/cart'],
    ['DELETE', '/api/v1/cart'],
    ['PUT', '/api/v1/cart/items/:itemId', { quantity: 1 }],
    ['DELETE', '/api/v1/cart/items/:itemId'],
    ['POST', '/api/v1/orders', {}],
    ['GET', '/api/v1/orders'],
    ['GET', '/api/v1/orders/:id'],
    ['POST', '/api/v1/orders/:id/cancel', {}],
    ['POST', '/api/v1/orders/:id/pay', {}],
    ['GET', '/api/v1/orders/:id/payments'],
  ],
  'Vendedor (token)': [
    ['GET', '/api/v1/seller/organization'],
    ['GET', '/api/v1/seller/store'],
    ['GET', '/api/v1/seller/orders'],
    ['GET', '/api/v1/seller/orders/:id'],
    ['POST', '/api/v1/seller/orders/:id/status', {}],
    ['GET', '/api/v1/seller/categories'],
    ['POST', '/api/v1/seller/categories', { name: '' }],
    ['GET', '/api/v1/seller/items'],
    ['POST', '/api/v1/seller/items', {}],
    ['GET', '/api/v1/seller/items/:id'],
    ['GET', '/api/v1/seller/items/:id/stock'],
  ],
};

const $ = (id) => document.getElementById(id);
const SPECS = [];

$('origin').textContent = location.origin;

const preset = $('preset');
preset.append(new Option('— Personalizado —', ''));
for (const [group, list] of Object.entries(GROUPS)) {
  const og = document.createElement('optgroup');
  og.label = group;
  for (const spec of list) {
    SPECS.push(spec);
    og.append(new Option(`${spec[0].padEnd(6)} ${spec[1]}`, String(SPECS.length - 1)));
  }
  preset.append(og);
}

preset.addEventListener('change', () => {
  if (preset.value === '') return;
  const [method, path, body] = SPECS[Number(preset.value)];
  $('method').value = method;
  $('path').value = path;
  $('body').value = body ? JSON.stringify(body, null, 2) : '';
});

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function highlight(json) {
  return esc(json).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (m, str, colon, bool) => {
      if (str) return colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`;
      if (bool) return `<span class="b">${m}</span>`;
      return `<span class="n">${m}</span>`;
    },
  );
}

function setLoading(on) {
  $('send').disabled = on;
  $('send').classList.toggle('loading', on);
  $('sendLabel').textContent = on ? 'Enviando…' : 'Enviar petición';
}

function showStatus(text, kind) {
  $('status').innerHTML = `<span class="pill s-${kind}">${esc(text)}</span>`;
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const method = $('method').value;
  const token = $('token').value.trim();
  const body = $('body').value.trim();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && method !== 'GET') headers['Content-Type'] = 'application/json';

  setLoading(true);
  $('status').textContent = '';
  $('meta').textContent = '';
  $('out').className = 'empty';
  $('out').textContent = 'Esperando respuesta…';
  const t0 = performance.now();
  try {
    const r = await fetch($('path').value.trim(), {
      method,
      headers,
      body: body && method !== 'GET' ? body : undefined,
    });
    const text = await r.text();
    const ms = Math.round(performance.now() - t0);
    showStatus(`${r.status} ${r.statusText}`.trim(), r.ok ? 'ok' : r.status < 500 ? 'warn' : 'err');
    $('meta').textContent = `${ms} ms · ${text.length} bytes`;
    let shown = text;
    try { shown = JSON.stringify(JSON.parse(text), null, 2); $('out').innerHTML = highlight(shown); }
    catch { $('out').textContent = text || '(respuesta vacía)'; }
    $('out').className = '';
    $('out').dataset.raw = shown;
  } catch (err) {
    showStatus('Error de red', 'err');
    $('out').className = '';
    $('out').textContent = err.message;
    $('out').dataset.raw = err.message;
  } finally {
    setLoading(false);
  }
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('out').dataset.raw ?? $('out').textContent);
    $('copy').textContent = '¡Copiado!';
    setTimeout(() => { $('copy').textContent = 'Copiar'; }, 1200);
  } catch { /* sin permiso de portapapeles */ }
});
