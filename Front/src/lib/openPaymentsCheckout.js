import { language } from '../i18n/instance';

export function readAssetAmount(amount) {
  if (!amount || !/^[A-Z]{3}$/.test(amount.assetCode || '') || !Number.isInteger(amount.assetScale) || amount.assetScale < 0 || amount.assetScale > 9 || !/^\d+$/.test(String(amount.value))) return null;
  let minor;
  try { minor = BigInt(amount.value); } catch { return null; }
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const currency = amount.assetCode, scale = amount.assetScale;
  try {
    const value = Number(minor) / (10 ** scale);
    return { value, currency, scale };
  } catch { return null; }
}
export function assetMoney(amount) {
  return new Intl.NumberFormat(language(), { style: 'currency', currency: amount.currency, minimumFractionDigits: amount.scale, maximumFractionDigits: amount.scale }).format(amount.value);
}
export function readCheckout(checkout) {
  if (!checkout || !Object.hasOwn(checkout, 'fee') || typeof checkout.redirectUrl !== 'string' || !checkout.expiresAt || !Number.isFinite(Date.parse(checkout.expiresAt))) return null;
  try {
    const url = new URL(checkout.redirectUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
  } catch { return null; }
  const receive = readAssetAmount(checkout.receive), debit = readAssetAmount(checkout.debit);
  const fee = checkout.fee == null ? null : readAssetAmount(checkout.fee);
  if (!receive || !debit || (checkout.fee != null && !fee)) return null;
  let buyerWallet = null;
  if (typeof checkout.buyerWallet === 'string') {
    try {
      const url = new URL(checkout.buyerWallet);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) buyerWallet = url.href;
    } catch { /* The optional wallet label does not affect the quote. */ }
  }
  return { redirectUrl: checkout.redirectUrl, expiresAt: checkout.expiresAt, receive, debit, fee, buyerWallet };
}
export function timeRemaining(expiresAt, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return { expired: seconds === 0, minutes: Math.floor(seconds / 60), seconds: seconds % 60 };
}
