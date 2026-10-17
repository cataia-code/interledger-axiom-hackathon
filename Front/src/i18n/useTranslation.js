import { useSyncExternalStore } from 'react';
import { changeLanguage, language, subscribeLanguage, t } from './instance';
export function useTranslation() {
  const currentLanguage = useSyncExternalStore(subscribeLanguage, language, () => 'es-CO');
  return { t, i18n: { language: currentLanguage, changeLanguage } };
}
