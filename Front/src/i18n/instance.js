import { en } from './catalogues';
import { browserLocale, supportedLocale } from './locale';
const normalize = locale => supportedLocale(locale)?.split('-')[0] || 'es';
let locale = typeof document === 'undefined' ? 'es-CO' : browserLocale();
const listeners = new Set();
export function language() { return locale; }
export function subscribeLanguage(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function changeLanguage(next) { if (locale === next) return; locale = next; for (const listener of listeners) listener(); }
export function t(key, options = {}) {
  if (typeof key !== 'string') return key;
  const text = normalize(locale) === 'en' ? (Object.hasOwn(en, key) ? en[key] : key) : key;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => String(options[name] ?? `{{${name}}}`));
}
