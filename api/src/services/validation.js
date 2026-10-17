import { HttpError } from '../middlewares/errorHandler.js';
import { resolveCountry } from './countries.js';

export const bad = (message, code) => new HttpError(400, message, code);
export const str = (v) => (typeof v === 'string' ? v.trim() : '');
export const object = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// País de origen: código ISO 3166-1 de 2 letras o nombre del país; se guarda el código en mayúsculas.
export function countryCode(value, field = 'country', code = 'INVALID_COUNTRY') {
  const resolved = resolveCountry(value);
  if (!resolved) throw bad(`${field} must be an ISO 3166-1 country code (e.g. CO) or a country name (e.g. Colombia)`, code);
  return resolved;
}

export function required(value, field, min, max, code) {
  const v = str(value);
  if (v.length < min || v.length > max) throw bad(`${field} must be between ${min} and ${max} characters`, code);
  return v;
}

export function optional(value, field, max, code) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw bad(`${field} must be a string of at most ${max} characters`, code);
  }
  return value.trim() || null;
}

// Entero dentro de [min, max]; acepta números o strings numéricos.
export function integer(value, field, min, max, code) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isSafeInteger(n) || n < min || n > max) throw bad(`${field} must be an integer between ${min} and ${max}`, code);
  return n;
}

// Id numérico de un parámetro de ruta; 404 si no es válido.
export function parseId(value, notFoundMessage, code) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || String(n) !== String(value)) throw new HttpError(404, notFoundMessage, code);
  return n;
}
