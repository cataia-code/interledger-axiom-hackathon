import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
if (existsSync(path.join(root, '.env')) && process.loadEnvFile) process.loadEnvFile(path.join(root, '.env'));
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3000;
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
