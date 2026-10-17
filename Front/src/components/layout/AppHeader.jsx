import { useApp } from '../../context/AppContext';
import { money } from '../../lib/currency';
import BrandLogo from './BrandLogo';
import Icon from '../ui/Icon';
export default function AppHeader() {
  const { navigate, balanceUSD } = useApp();
  return <header className="app-header"><a href="#map" className="header-brand" onClick={event => { event.preventDefault(); navigate('map'); }}><BrandLogo /></a>
    <div className="header-actions"><button className="location-button" onClick={() => navigate('map')}><Icon name="pin" /><span>Medellín</span><Icon name="down" /></button>
      <button className="wallet-chip" onClick={() => navigate('wallet')} aria-label={`Mi wallet, saldo ${money(balanceUSD, 'USD')}`}><Icon name="wallet" /><span><small>WALLET</small><b>{money(balanceUSD, 'USD')}</b></span></button>
    </div>
  </header>;
}
