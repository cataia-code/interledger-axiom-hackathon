import { useTranslation } from '../../i18n/useTranslation';
export default function FilterChips({ options, value, onChange, label = 'Filtrar por categoría' }) {
  const { t } = useTranslation();
  return <div className="filter-chips" role="group" aria-label={t(label)}>
    {options.map(option => <button key={option} className={`chip ${value === option ? 'is-active' : ''}`}
      aria-pressed={value === option} onClick={() => onChange(option)}>{t(option)}</button>)}
  </div>;
}
