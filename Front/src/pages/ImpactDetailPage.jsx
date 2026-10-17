import { useApp } from '../context/AppContext';
import { shops } from '../data/shops';
import PageHeading, { SectionHeading } from '../components/ui/PageHeading';
import SpendDonut from '../components/charts/SpendDonut';
import StoreLogo from '../components/shops/StoreLogo';
import Icon from '../components/ui/Icon';
export default function ImpactDetailPage() {
  const { navigate, openShop } = useApp();
  return <><PageHeading eyebrow="TU HUELLA LOCAL" title="Impacto de tu viaje" description="Compras que fortalecen las comunidades que visitas." onBack={() => navigate('impact')} />
    <div className="context-chips"><span><Icon name="pin" />Medellín, Colombia</span><span>Viaje de ejemplo</span></div><SectionHeading title="Distribución de tu gasto" /><SpendDonut />
    <SectionHeading title="Impacto por tienda" /><div className="link-list">{shops.slice(0, 4).map((shop, index) => <button className="surface impact-shop" key={shop.id} onClick={() => openShop(shop.id)}><StoreLogo shop={shop} /><span>{shop.name}</span><b>${[40, 35, 25, 20][index]} USD</b><Icon name="chevron" /></button>)}</div>
  </>;
}
