import { language } from '../i18n/instance';
// Reference rate for the prototype, not a live exchange quote.
export const REFERENCE_RATE = 4000;
export const money = (value, currency = 'COP') => new Intl.NumberFormat(language(), {
  style: 'currency', currency, ...(currency === 'COP' ? { minimumFractionDigits: 0, maximumFractionDigits: 2 } : {}),
}).format(value);
export const toUSD = amountCOP => Number(amountCOP) / REFERENCE_RATE;
