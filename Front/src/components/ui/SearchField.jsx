import { useTranslation } from '../../i18n/useTranslation';
import Icon from './Icon';
export default function SearchField({ value, onChange, placeholder = 'Buscar tiendas, productos o categorías', label = 'Buscar tiendas' }) {
  const { t } = useTranslation();
  return <label className="search-field"><Icon name="search" /><input type="search" aria-label={t(label)}
    value={value} onChange={event => onChange(event.target.value)} placeholder={t(placeholder)} /></label>;
}
