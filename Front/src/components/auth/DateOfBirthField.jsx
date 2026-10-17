import { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';

const today = new Date();

export default function DateOfBirthField({ value, onChange, error }) {
  const { t, i18n } = useTranslation();
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [visibleMonth, setVisibleMonth] = useState(() => selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1));
  const [open, setOpen] = useState(false);
  const monthLabel = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(visibleMonth);
  const weekdays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(new Date(2024, 0, 1 + index)));
  }, [i18n.language]);
  const days = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const offset = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7;
  const years = Array.from({ length: today.getFullYear() - 1899 }, (_, index) => today.getFullYear() - index);

  function chooseDay(day) {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    if (date > new Date(today.getFullYear(), today.getMonth(), today.getDate())) return;
    onChange({ target: { name: 'dateOfBirth', value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` } });
    setOpen(false);
  }
  function changeMonth(delta) { setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1)); }

  return <div className="seller-date-field"><span>{t('Fecha de nacimiento')}</span>
    <button type="button" className="seller-date-field__trigger" aria-label={t('Fecha de nacimiento')} aria-haspopup="dialog" aria-expanded={open} aria-invalid={Boolean(error)} onClick={() => setOpen(current => !current)}>
      <span>{selected ? new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }).format(selected) : t('Selecciona año, mes y día')}</span><span aria-hidden="true">▦</span>
    </button>
    {open && <div className="seller-calendar" role="dialog" aria-label={t('Fecha de nacimiento')}>
      <div className="seller-calendar__header"><button type="button" aria-label={t('Mes anterior')} onClick={() => changeMonth(-1)}>‹</button><strong>{monthLabel}</strong><button type="button" aria-label={t('Mes siguiente')} disabled={visibleMonth.getFullYear() === today.getFullYear() && visibleMonth.getMonth() >= today.getMonth()} onClick={() => changeMonth(1)}>›</button></div>
      <div className="seller-calendar__selectors"><select aria-label={t('Mes')} value={visibleMonth.getMonth()} onChange={event => setVisibleMonth(current => new Date(current.getFullYear(), Number(event.target.value), 1))}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(new Date(2024, month, 1))}</option>)}</select><select aria-label={t('Año')} value={visibleMonth.getFullYear()} onChange={event => setVisibleMonth(current => new Date(Number(event.target.value), current.getMonth(), 1))}>{years.map(year => <option key={year}>{year}</option>)}</select></div>
      <div className="seller-calendar__grid" role="grid">{weekdays.map((weekday, index) => <span className="seller-calendar__weekday" key={`${weekday}-${index}`}>{weekday}</span>)}{Array.from({ length: offset }, (_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day); const future = date > new Date(today.getFullYear(), today.getMonth(), today.getDate()); const isSelected = selected?.getFullYear() === date.getFullYear() && selected?.getMonth() === date.getMonth() && selected?.getDate() === day; return <button type="button" aria-selected={isSelected} className={isSelected ? 'is-selected' : ''} disabled={future} key={day} onClick={() => chooseDay(day)}>{day}</button>; })}</div>
    </div>}
    {error && <small className="seller-location-error" role="alert">{error}</small>}
  </div>;
}
