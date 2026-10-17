import { useApp } from '../../context/AppContext';
import { money } from '../../lib/currency';
import { REFERENCE_RATE } from '../../lib/currency';
import Icon from '../ui/Icon';
export default function HomeWalletCard() {
  const { navigate, user, balanceUSD, walletLoading, openAccount, createMyStore, ownedShop } = useApp();
  return <section className="home-wallet-card" aria-label="Resumen de tu wallet"><button className="home-wallet-card__balance" onClick={() => user ? navigate('wallet') : openAccount('buy', 'wallet')}>
    <span className="home-wallet-card__icon"><Icon name="wallet" /></span><span><small>{user ? 'TU WALLET' : 'TU WALLET DE VIAJE'}</small><b>{walletLoading ? '···' : money(balanceUSD, 'USD')}</b></span>
    <span className="home-wallet-card__exchange">≈ {walletLoading ? '···' : money(balanceUSD * REFERENCE_RATE)} COP</span><Icon name="chevron" className="home-wallet-card__arrow" /></button>
    {user && !ownedShop && <button className="home-wallet-card__business" onClick={createMyStore}><Icon name="shop" /><span>¿Tienes un negocio?</span><b>Crea tu tienda</b><Icon name="arrowRight" /></button>}
  </section>;
}
