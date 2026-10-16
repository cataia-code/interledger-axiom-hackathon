import { HttpError } from '../middlewares/errorHandler.js';

const bad = (message, code) => new HttpError(400, message, code);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

function required(value, field, min, max, code) {
  const v = str(value);
  if (v.length < min || v.length > max) throw bad(`${field} must be between ${min} and ${max} characters`, code);
  return v;
}

function optional(value, field, max, code) {
  if (value == null) return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw bad(`${field} must be a string of at most ${max} characters`, code);
  }
  return value.trim() || null;
}

const object = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// Datos legales de la organización.
export function validateOrganizationInput(input) {
  const b = object(input);
  const legalName = required(b.legalName, 'organization.legalName', 2, 120, 'INVALID_LEGAL_NAME');
  const country = str(b.country).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw bad('organization.country must be a 2-letter ISO code', 'INVALID_COUNTRY');
  return {
    legalName,
    tradeName: optional(b.tradeName, 'organization.tradeName', 120, 'INVALID_TRADE_NAME'),
    taxId: required(b.taxId, 'organization.taxId', 3, 40, 'INVALID_TAX_ID'),
    country,
    legalAddress: required(b.legalAddress, 'organization.legalAddress', 5, 200, 'INVALID_LEGAL_ADDRESS'),
    phone: optional(b.phone, 'organization.phone', 30, 'INVALID_PHONE'),
  };
}

// Datos de una sucursal.
export function validateStoreInput(input) {
  const b = object(input);
  return {
    name: required(b.name, 'store.name', 2, 80, 'INVALID_NAME'),
    description: optional(b.description, 'store.description', 500, 'INVALID_DESCRIPTION'),
    address: required(b.address, 'store.address', 5, 200, 'INVALID_ADDRESS'),
    city: required(b.city, 'store.city', 2, 80, 'INVALID_CITY'),
    phone: optional(b.phone, 'store.phone', 30, 'INVALID_PHONE'),
  };
}
