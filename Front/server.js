import http from 'node:http';
import https from 'node:https';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
if (process.loadEnvFile) { for (const filename of ['.env', '.env.local']) { const envFile = path.join(root, filename); if (existsSync(envFile)) process.loadEnvFile(envFile); } }
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3000;
const axiomOrigin = new URL(process.env.AXIOM_API_ORIGIN || 'https://interledger-axiom-hackathon-production.up.railway.app');
if (!['https:', 'http:'].includes(axiomOrigin.protocol) || axiomOrigin.username || axiomOrigin.password || axiomOrigin.pathname !== '/' || axiomOrigin.search || axiomOrigin.hash) throw new Error('AXIOM_API_ORIGIN debe ser el origen HTTP(S) del backend, sin ruta ni credenciales.');
const axiomTransport = axiomOrigin.protocol === 'https:' ? https : http;
function proxyAxiom(request, response, pathname, search) {
  if (!pathname.startsWith('/api/v1/')) { response.writeHead(404, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Ruta API no disponible.' } })); return; }
  const upstreamPath = pathname + search;
  const upstream = axiomTransport.request(new URL(upstreamPath, axiomOrigin), {
    method: request.method,
    headers: Object.fromEntries(['accept', 'authorization', 'content-type', 'idempotency-key'].filter(name => request.headers[name]).map(name => [name, request.headers[name]])),
  }, result => {
    const responseHeaders = {};
    for (const name of ['content-type', 'retry-after', 'cache-control']) if (result.headers[name]) responseHeaders[name] = result.headers[name];
    response.writeHead(result.statusCode || 502, responseHeaders);
    result.pipe(response);
  });
  upstream.setTimeout(25000, () => upstream.destroy(new Error('AXIOM_TIMEOUT')));
  upstream.on('error', error => {
    if (!response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: { code: error.message === 'AXIOM_TIMEOUT' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE', message: 'No pudimos conectar con Axiom API. Intenta de nuevo.' } }));
    } else response.destroy();
  });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
}
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

if (production && !existsSync(path.join(root, 'dist/index.html'))) {
  console.error('Primero ejecuta npm run build.'); process.exit(1);
}
const vite = production ? null : await (await import('vite')).createServer({
  root, server: { middlewareMode: true }, appType: 'spa',
});
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/api/config') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      // Browser map keys are intentionally public and must have Google referrer restrictions.
      response.end(JSON.stringify({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '' }));
      return;
    }
    if (pathname.startsWith('/api/v1/')) { proxyAxiom(request, response, pathname, new URL(request.url, 'http://localhost').search); return; }
    if (pathname.startsWith('/api/')) { response.writeHead(404); response.end('API no disponible'); return; }
    if (vite) { vite.middlewares(request, response); return; }
    const directory = path.join(root, 'dist');
    const filename = path.resolve(directory, pathname.replace(/^\/+/, '') || 'index.html');
    if (!filename.startsWith(directory + path.sep)) { response.writeHead(403); response.end('Forbidden'); return; }
    try {
      const content = await readFile(filename);
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filename)] || 'application/octet-stream' });
      response.end(content);
    } catch (error) {
      if (!path.extname(pathname)) { response.writeHead(200, { 'Content-Type': mimeTypes['.html'] }); response.end(readFileSync(path.join(directory, 'index.html'))); }
      else { response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end('Not found'); }
    }
  } catch { response.writeHead(400); response.end('Bad request'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} ya está ocupado.` : error.message); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`Lokora · ${production ? 'producción' : 'desarrollo React + Vite'} · http://127.0.0.1:${port}`));
