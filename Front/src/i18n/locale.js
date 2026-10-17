const PREFERENCE_KEY = 'lokora:language-preference';
export function supportedLocale(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const locale = Intl.getCanonicalLocales(value.trim().replaceAll('_', '-'))[0];
    const language = locale.split('-')[0];
    if (!['es', 'en'].includes(language)) return null;
    return locale.includes('-') ? locale : language === 'en' ? 'en-US' : 'es-CO';
  } catch { return null; }
}
export function browserLocale() {
  if (typeof navigator === 'undefined') return 'es-CO';
  for (const locale of navigator.languages || [navigator.language]) {
    const supported = supportedLocale(locale); if (supported) return supported;
  }
  return 'es-CO';
}
export function storedPreference() {
  try { const value = localStorage.getItem(PREFERENCE_KEY); return ['es', 'en'].includes(value) ? value : 'auto'; }
  catch { return 'auto'; }
}
export function storePreference(value) {
  try { if (value === 'auto') localStorage.removeItem(PREFERENCE_KEY); else localStorage.setItem(PREFERENCE_KEY, value); } catch { /* Preference still works during this session. */ }
}
export function resolveLocale(preference, profileLocale) {
  return (preference !== 'auto' && supportedLocale(preference)) || supportedLocale(profileLocale) || browserLocale();
}
