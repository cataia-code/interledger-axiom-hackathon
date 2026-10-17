import { money } from '../../lib/currency';
export const spendingCategories = [
  { label: 'Gastronomía', value: 40, color: 'var(--teal)' },
  { label: 'Artesanías', value: 30, color: 'var(--wine)' },
  { label: 'Moda', value: 20, color: '#dfad5b' },
  { label: 'Otros', value: 10, color: 'var(--gold)' },
];
export default function SpendDonut({ total = 120 }) {
  return <div className="surface spending-chart"><div className="spend-donut" role="img" aria-label={`Distribución de ${total} USD: gastronomía 40%, artesanías 30%, moda 20%, otros 10%`}><span>{money(total, 'USD')}<small>TOTAL DEL VIAJE</small></span></div>
    <ul>{spendingCategories.map(item => <li key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><b>{item.value}%</b></li>)}</ul>
  </div>;
}
