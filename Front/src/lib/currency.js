// Reference rate for the prototype, not a live exchange quote.
export const REFERENCE_RATE = 4000;
export const money = (value, currency = 'COP') => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency, maximumFractionDigits: currency === 'COP' ? 0 : 2,
}).format(value);
export const toUSD = amountCOP => Number(amountCOP) / REFERENCE_RATE;
