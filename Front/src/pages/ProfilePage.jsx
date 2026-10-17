import { useApp } from '../context/AppContext';
import PageHeading, { SectionHeading } from '../components/ui/PageHeading';
import RowLink from '../components/ui/RowLink';
import { Button } from '../components/ui/Button';
import { money } from '../lib/currency';
export default function ProfilePage() {
  const { navigate, balanceUSD, setDialog } = useApp();
  return <><PageHeading eyebrow="CUENTA LOKORA" title="Hola, Lucía" description="Tu viaje, tu wallet y tu impacto en un solo lugar." />
    <div className="surface profile-summary"><span className="profile-avatar">LM</span><span><b>Lucía Martínez</b><small>Viajera exploradora · USD</small></span><Button variant="quiet" onClick={() => setDialog({ title: 'Tu perfil', description: 'Esta es una cuenta de ejemplo para recorrer Lokora.' })}>Editar</Button></div>
    <SectionHeading title="Mi espacio" /><div className="link-list">{[
      ['wallet', 'wallet', 'Mi wallet', `Saldo disponible · ${money(balanceUSD, 'USD')}`],
      ['seller', 'shop', 'Panel del vendedor', 'Gestiona tu tienda Lokora'],
      ['stats', 'growth', 'Estadísticas de ventas', 'Revisa tus resultados'],
      ['scheduled', 'bank', 'Pagos programados', 'Frecuencia y cuenta de abono'],
      ['settings', 'settings', 'Configuración de pagos', 'Ajusta pagos y notificaciones'],
    ].map(([route, icon, title, description]) => <RowLink key={route} icon={icon} title={title} description={description} onClick={() => navigate(route)} />)}</div><Button variant="outline" className="wide space-top" onClick={() => navigate('welcome')}>Cerrar sesión</Button>
  </>;
}
