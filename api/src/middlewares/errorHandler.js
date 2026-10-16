import { config } from '../config/index.js';

export class HttpError extends Error {
  constructor(status, message, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Better Auth usa `status` como texto ("INTERNAL_SERVER_ERROR") y `statusCode` como número.
  const status = [err.status, err.statusCode].find((n) => Number.isInteger(n) && n >= 400 && n < 600) ?? 500;
  const isServerError = status >= 500;
  if (isServerError) req.log?.error(err);
  res.status(status).json({
    error: {
      message: isServerError && config.env === 'production' ? 'Internal Server Error' : err.message,
      code: err.code ?? (isServerError ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
    },
  });
}
