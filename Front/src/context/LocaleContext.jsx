import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { changeLanguage } from '../i18n/instance';
import { resolveLocale, storedPreference, storePreference } from '../i18n/locale';
const LocaleContext = createContext(null);
export function LocaleProvider({ children }) {
  const { user } = useAuth();
  const [preference, setStoredPreference] = useState(storedPreference);
  const locale = resolveLocale(preference, user?.locale);
  useEffect(() => { changeLanguage(locale); document.documentElement.lang = locale; document.documentElement.dir = 'ltr'; }, [locale]);
  function setPreference(value) { if (['auto', 'es', 'en'].includes(value)) { storePreference(value); setStoredPreference(value); } }
  return <LocaleContext.Provider value={{ locale, preference, setPreference }}>{children}</LocaleContext.Provider>;
}
export const useLocale = () => useContext(LocaleContext);
