import { pipeline } from 'node:stream/promises';
import { HttpError } from '../middlewares/errorHandler.js';
import { storage } from './index.js';

const SAFE_KEY = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/;

// GET /uploads/<clave>: entrega la imagen desde el almacén (disco o bucket). Las claves llevan un UUID, así que son inmutables.
export async function serveUpload(req, res, next) {
  try {
    const key = [].concat(req.params.splat).join('/');
    if (!SAFE_KEY.test(key) || key.includes('..')) throw new HttpError(404, 'File not found', 'NOT_FOUND');
    const object = await storage.get(key);
    if (!object) throw new HttpError(404, 'File not found', 'NOT_FOUND');
    res.set({
      'Content-Type': object.contentType,
      'Cache-Control': 'public, max-age=604800, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    if (object.contentLength != null) res.set('Content-Length', String(object.contentLength));
    await pipeline(object.stream, res);
  } catch (err) {
    if (res.headersSent) return res.destroy(err);
    next(err);
  }
}
