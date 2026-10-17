import Icon from './Icon';
export default function SearchField({ value, onChange, placeholder = 'Buscar tiendas, productos o categorías', label = 'Buscar tiendas' }) {
  return <label className="search-field"><Icon name="search" /><input type="search" aria-label={label}
    value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
