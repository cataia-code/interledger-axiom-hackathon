import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import Icon from '../ui/Icon';
export default function HomeWalletCard() {
  const { t } = useTranslation();
  const { navigate, user, openAccount, createMyStore, ownedShop } = useApp();
  if (user?.role === 'seller') return <section className="home-wallet-card"><button className="home-wallet-card__balance" onClick={createMyStore}><span className="home-wallet-card__icon"><Icon name="shop" /></span><span><small>{t("TU NEGOCIO EN LOKORA")}</small><b>{ownedShop?.name || t('Mi tienda')}</b><small>{t("Gestiona tu sucursal")}</small></span><Icon name="chevron" className="home-wallet-card__arrow" /></button></section>;
  return <section className="home-wallet-card" aria-label={t("Tus compras")}><button className="home-wallet-card__balance" onClick={() => user ? navigate('wallet') : openAccount('buy', 'wallet')}>
    <span className="home-wallet-card__icon"><Icon name="wallet" /></span><span><small>{t("TU EXPERIENCIA LOCAL")}</small><b>{t("Compras con historia")}</b><small>{t("Revisa tus comprobantes")}</small></span><Icon name="chevron" className="home-wallet-card__arrow" /></button>

  </section>;
}
