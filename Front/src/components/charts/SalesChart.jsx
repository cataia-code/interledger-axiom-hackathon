export default function SalesChart({ values, label = 'Ventas del período seleccionado' }) {
  const max = Math.max(...values);
  const gap = 6;
  const width = (320 - (values.length - 1) * gap) / values.length;
  return <figure className="surface sales-chart"><figcaption>{label}<small>Datos de ejemplo</small></figcaption><svg viewBox="0 0 340 150" role="img" aria-label={`${label}. ${values.length} intervalos.`}>
    {[30, 65, 100, 135].map(y => <path key={y} d={`M10 ${y}H330`} stroke="var(--line)" strokeWidth="1" />)}
    {values.map((value, index) => { const height = value / max * 112; return <rect key={index} className="sales-bar" style={{ animationDelay: `${index * 16}ms` }} x={10 + index * (width + gap)} y={135 - height} width={width} height={height} rx="3" fill={index > values.length - 4 ? 'var(--wine)' : 'var(--teal)'} />; })}
  </svg><div className="chart-axis"><span>Inicio del período</span><span>Hoy</span></div></figure>;
}
