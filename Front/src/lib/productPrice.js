export function currencyScale(currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}
export function productPriceInput(amount, currency) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('La API devolvió un importe inválido.');
  const scale = currencyScale(currency);
  const digits = String(amount).padStart(scale + 1, '0');
  return scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
}
// Build the minor-unit integer from digits to avoid rounding a floating-point price.
export function productPriceAmount(value, currency) {
  const scale = currencyScale(currency);
  const pattern = scale ? new RegExp(`^\\d+(?:[.,]\\d{1,${scale}})?$`) : /^\d+$/;
  const text = String(value).trim();
  if (!pattern.test(text)) return null;
  const [whole, fraction = ''] = text.replace(',', '.').split('.');
  const amount = Number(whole + fraction.padEnd(scale, '0'));
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}
