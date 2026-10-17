import { useTranslation } from '../../i18n/useTranslation';
import { useLocale } from '../../context/LocaleContext';
export default function LanguageSelector({ compact = false }) {
  const { t } = useTranslation();
  const { locale, setPreference } = useLocale();
  const selected = locale.startsWith('en') ? 'en' : 'es';
  return <div className={`language-selector ${compact ? 'language-selector--compact' : ''}`} role="group" aria-label={t('Idioma')} data-language={selected}>
    <span className="language-selector__indicator" aria-hidden="true" />
    {[{ code: 'es', label: 'Español', flag: 'es-co' }, { code: 'en', label: 'English', flag: 'en-us' }].map(({ code, label, flag }) => <button key={code} type="button" lang={code} aria-label={label} title={label} aria-pressed={selected === code} onClick={() => setPreference(code)}><img src={`/assets/flags/${flag}.svg`} alt="" width="22" height="15" /><span>{code.toUpperCase()}</span></button>)}
  </div>;
}
