import BrandLogo from '../components/layout/BrandLogo';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';
export default function WelcomePage() {
  const { navigate, setDialog } = useApp();
  const showAccount = title => setDialog({ title, description: 'Este recorrido es una demostración. Continúa como visitante para explorar tiendas, cupones y tu wallet.' });
  return <section className="welcome"><div className="welcome__brand"><BrandLogo full /></div>
    <div className="welcome__copy"><span className="eyebrow">TU PRÓXIMA HISTORIA EMPIEZA AQUÍ</span><h1>Descubre lo local.<br />Conecta sin fronteras.</h1><p>Negocios únicos, historias cercanas y pagos sencillos en cada viaje.</p></div>
    <div className="welcome__art"><img src="/assets/medellin-mural.png" alt="Arte urbano de Medellín" /></div>
    <div className="welcome__actions"><Button className="wide" onClick={() => showAccount('Crear cuenta')}>Crear cuenta</Button><Button variant="secondary" className="wide" onClick={() => showAccount('Iniciar sesión')}>Iniciar sesión</Button><Button variant="quiet" icon="arrowRight" onClick={() => navigate('map')}>Continuar como visitante</Button></div>
  </section>;
}
