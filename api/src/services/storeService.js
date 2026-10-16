import { bad, object, optional, required, str } from './validation.js';

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
    legalId: required(b.legalId, 'organization.legalId', 3, 40, 'INVALID_LEGAL_ID'),
    country,
    legalAddress: required(b.legalAddress, 'organization.legalAddress', 5, 200, 'INVALID_LEGAL_ADDRESS'),
    phone: optional(b.phone, 'organization.phone', 30, 'INVALID_PHONE'),
  };
}

function coordinate(value, field, limit, code) {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n) || Math.abs(n) > limit) throw bad(`${field} must be a number between -${limit} and ${limit}`, code);
  return Math.round(n * 1e6) / 1e6;
}

// Datos de la sucursal.
export function validateStoreInput(input) {
  const b = object(input);
  const out = {
    name: required(b.name, 'store.name', 2, 80, 'INVALID_NAME'),
    description: optional(b.description, 'store.description', 500, 'INVALID_DESCRIPTION'),
    address: required(b.address, 'store.address', 5, 200, 'INVALID_ADDRESS'),
    city: required(b.city, 'store.city', 2, 80, 'INVALID_CITY'),
    phone: optional(b.phone, 'store.phone', 30, 'INVALID_PHONE'),
    latitude: coordinate(b.latitude, 'store.latitude', 90, 'INVALID_LATITUDE'),
    longitude: coordinate(b.longitude, 'store.longitude', 180, 'INVALID_LONGITUDE'),
    legalId: required(b.legalId, 'store.legalId', 3, 40, 'INVALID_LEGAL_ID'),
  };
  const currency = str(b.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw bad('store.currency must be a 3-letter ISO 4217 code', 'INVALID_CURRENCY');
  return { ...out, currency };
}

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

// Edición parcial: se mezcla con lo guardado y se valida completo. taxId, legalId y country no cambian.
const ORG_EDITABLE = ['legalName', 'tradeName', 'legalAddress', 'phone'];
export function validateOrganizationPatch(existing, body) {
  const patch = pick(object(body), ORG_EDITABLE);
  if (Object.keys(patch).length === 0) throw bad('Nothing to update', 'EMPTY_UPDATE');
  const full = validateOrganizationInput({ ...existing, ...patch });
  return pick(full, ORG_EDITABLE);
}

// legalId y currency no cambian (la moneda está ligada a los precios).
const STORE_EDITABLE = ['name', 'description', 'address', 'city', 'phone', 'latitude', 'longitude'];
export const STORE_STATUSES = ['active', 'paused'];
export function validateStorePatch(existing, body) {
  const b = object(body);
  const patch = pick(b, STORE_EDITABLE);
  const out = {};
  if (b.status !== undefined) {
    if (!STORE_STATUSES.includes(b.status)) throw bad('store.status must be active or paused', 'INVALID_STATUS');
    out.status = b.status;
  }
  if (Object.keys(patch).length === 0 && !out.status) throw bad('Nothing to update', 'EMPTY_UPDATE');
  if (Object.keys(patch).length > 0) {
    Object.assign(out, pick(validateStoreInput({ ...existing, ...patch }), STORE_EDITABLE));
  }
  return out;
}
