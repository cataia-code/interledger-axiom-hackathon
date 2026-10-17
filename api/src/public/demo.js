/* global document */
const $ = (id) => document.getElementById(id);

async function send() {
  const method = $('method').value;
  const token = $('token').value.trim();
  const body = $('body').value.trim();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  $('out').textContent = '...';
  try {
    const r = await fetch($('path').value, { method, headers, body: body && method !== 'GET' ? body : undefined });
    const text = await r.text();
    let pretty = text;
    try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* no es JSON */ }
    $('out').textContent = `${r.status} ${r.statusText}\n\n${pretty}`;
  } catch (e) {
    $('out').textContent = `Error: ${e.message}`;
  }
}

$('send').addEventListener('click', send);
