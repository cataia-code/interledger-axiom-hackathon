import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getShop } from '../../data/shops';
import { salesByPeriod } from '../../data/merchant';
import PageHeading, { SectionHeading } from '../../components/ui/PageHeading';
import MerchantSummary from '../../components/shops/MerchantSummary';
import FilterChips from '../../components/ui/FilterChips';
import MetricCard from '../../components/ui/MetricCard';
import RowLink from '../../components/ui/RowLink';
import { Button } from '../../components/ui/Button';
import { money } from '../../lib/currency';
export default function SellerPage() {
  const { navigate, openShop } = useApp();
  const [period, setPeriod] = useState('Mes');
  const data = salesByPeriod[period];
  return <><PageHeading eyebrow="PANEL DEL VENDEDOR" title="Hola, Ana" description="Cada venta conecta nuevas historias." onBack={() => navigate('profile')} />
    <MerchantSummary shop={getShop('craft')}><Button variant="quiet" icon="arrowRight" onClick={() => openShop('craft')}>Ver tienda</Button></MerchantSummary>
    <FilterChips options={Object.keys(salesByPeriod)} value={period} onChange={setPeriod} label="Período de ventas" />
    <MetricCard label="Ventas totales" value={money(data.total)} trend={data.growth} icon="growth" /><div className="metric-grid"><MetricCard label="Pagos recibidos" value={data.payments} trend="+18%" /><MetricCard label="Clientes internacionales" value={data.international} trend="+35%" /></div>
    <Button className="wide space-top" icon="growth" onClick={() => navigate('stats')}>Ver estadísticas</Button><SectionHeading title="Atajos del negocio" /><div className="link-list"><RowLink icon="bank" title="Pagos programados" description="Configura la frecuencia de tus abonos" onClick={() => navigate('scheduled')} /><RowLink icon="settings" title="Configuración de pagos" description="Activa, pausa o ajusta tus pagos" onClick={() => navigate('settings')} /></div><p className="demo-note">Panel con datos de ejemplo.</p>
  </>;
}
