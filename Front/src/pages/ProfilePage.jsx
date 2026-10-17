import { useTranslation } from '../i18n/useTranslation';
import { DATA_SOURCE } from '../services/api/client';
import { useApp } from '../context/AppContext';
import PageHeading, { SectionHeading } from '../components/ui/PageHeading';
import RowLink from '../components/ui/RowLink';
import { Button } from '../components/ui/Button';
export default function ProfilePage() {
  const { t } = useTranslation();
  const { navigate, user, ownedShop, createMyStore } = useApp();
  const seller = user?.role === 'seller';
  const name = user?.name || 'viajero';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('');
  return <><PageHeading eyebrow={seller ? 'CUENTA DE VENDEDOR' : 'CUENTA DE COMPRADOR'} title={t('Hola, {{name}}', { name: name.split(' ')[0] })} description={seller ? 'Gestiona tu sucursal y sus pedidos.' : 'Descubre tiendas y revisa tus compras locales.'} />
    <div className="surface profile-summary"><span className="profile-avatar">{initials}</span><span><b>{name}</b><small>{user?.email}</small></span></div>
    {seller ? <><SectionHeading title={t("Mi negocio")} /><div className="link-list">{ownedShop ? <><RowLink icon="shop" title={ownedShop.name} description={t("Gestiona tu sucursal")} onClick={() => navigate('seller')} /><RowLink icon="ticket" title={t("Cupones de mi tienda")} onClick={() => navigate('sellerCoupons')} /><RowLink icon="wallet" title={t("Wallets de mi negocio")} description={t("Revisa tu wallet y moneda de recepción")} onClick={() => navigate('wallets')} /><RowLink icon="settings" title={t("Editar mi tienda")} onClick={() => navigate('createStore')} /><RowLink icon="growth" title={t("Estadísticas de ventas")} onClick={() => navigate('stats')} /></> : <RowLink icon="shop" title={t("Mi tienda")} description={t("Configura tu negocio")} onClick={createMyStore} />}</div></> : <><SectionHeading title={t("Mis compras")} /><div className="link-list"><RowLink icon="wallet" title={t("Mis compras")} description={t("Tus comprobantes en comercios locales")} onClick={() => navigate('wallet')} /><RowLink icon="wallet" title={t("Mis wallets")} description={t("Agrega y organiza tus direcciones de Open Payments")} onClick={() => navigate('wallets')} /><RowLink icon="search" title={t("Descubrir tiendas")} onClick={() => navigate('home/list')} /></div></>}
    {DATA_SOURCE === 'api' && !user?.emailVerified && <Button className="wide space-top" variant="secondary" onClick={() => navigate('verifyEmail')}>{t("Verificar mi correo")}</Button>}
  </>;
}
