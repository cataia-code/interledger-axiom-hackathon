export default function FilterChips({ options, value, onChange, label = 'Filtrar por categoría' }) {
  return <div className="filter-chips" role="group" aria-label={label}>
    {options.map(option => <button key={option} className={`chip ${value === option ? 'is-active' : ''}`}
      aria-pressed={value === option} onClick={() => onChange(option)}>{option}</button>)}
  </div>;
}
