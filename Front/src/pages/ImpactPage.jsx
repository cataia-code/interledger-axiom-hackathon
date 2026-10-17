import { useApp } from '../context/AppContext';
import PageHeading, { SectionHeading } from '../components/ui/PageHeading';
import MetricCard from '../components/ui/MetricCard';
import Icon from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
export default function ImpactPage() {
  const { navigate } = useApp();
  return <><PageHeading eyebrow="VIAJAR TAMBIÉN ES APORTAR" title="Tu impacto" description="Con tus compras impulsas comunidades locales." />
    <div className="impact-hero"><img src="/assets/medellin-mural.png" alt="Arte y cultura urbana de Medellín" /><div><span className="eyebrow">ESTE VIAJE</span><h2>Cada compra conecta<br />una nueva oportunidad.</h2></div></div>
    <div className="metric-grid"><MetricCard label="Tiendas apoyadas" value="5" icon="shop" /><MetricCard label="Gasto total" value="$120 USD" icon="wallet" /><MetricCard label="Países visitados" value="1" icon="globe" /><MetricCard label="Emprendedores beneficiados" value="12" icon="people" /></div>
    <SectionHeading title="Tu impacto contribuye a" /><div className="impact-values">{[['shop', 'Economía local'], ['people', 'Empleos dignos'], ['culture', 'Cultura viva'], ['leaf', 'Comercio sostenible']].map(([icon, label]) => <div key={label}><Icon name={icon} /><span>{label}</span></div>)}</div>
    <Button className="wide" icon="arrowRight" onClick={() => navigate('impactDetail')}>Ver detalle de impacto</Button><p className="demo-note">Impacto ilustrativo de un viaje de ejemplo.</p>
  </>;
}
