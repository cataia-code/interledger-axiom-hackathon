import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { salesByPeriod, countries } from '../../data/merchant';
import PageHeading, { SectionHeading } from '../../components/ui/PageHeading';
import FilterChips from '../../components/ui/FilterChips';
import MetricCard from '../../components/ui/MetricCard';
import SalesChart from '../../components/charts/SalesChart';
import { money } from '../../lib/currency';
export default function SalesStatsPage() {
  const { navigate } = useApp();
  const [period, setPeriod] = useState('Mes');
  const data = salesByPeriod[period];
  return <><PageHeading eyebrow="RENDIMIENTO" title="Estadísticas de ventas" onBack={() => navigate('seller')} /><FilterChips options={Object.keys(salesByPeriod)} value={period} onChange={setPeriod} label="Período de estadísticas" />
    <MetricCard label="Ventas" value={money(data.total)} trend={data.growth} icon="growth" /><SalesChart key={period} values={data.bars} />
    <div className="metric-grid"><MetricCard label="Pagos" value={data.payments} trend="+18%" /><MetricCard label="Ticket promedio" value={money(data.total / data.payments)} trend="+12%" /></div>
    <SectionHeading title="Clientes por país" /><div className="surface information-card">{countries.map(country => <div className="country-row" key={country.code}><span className="country-code">{country.code}</span><span>{country.name}</span><span className="bar-track"><i style={{ width: `${country.share * 2}%` }} /></span><b>{country.share}%</b></div>)}</div>
  </>;
}
