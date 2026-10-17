import { useTranslation } from '../../i18n/useTranslation';
import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { sellerService } from '../../services/seller/sellerService';
import { minorToMajor } from '../../services/marketplace/itemAdapter';
import SellerProductCard from '../../components/merchant/SellerProductCard';
import { money } from '../../lib/currency';
import PageHeading, { SectionHeading } from '../../components/ui/PageHeading';
import MerchantSummary from '../../components/shops/MerchantSummary';
import { Button } from '../../components/ui/Button';
const labels = { pending_payment: 'Pendiente de pago', paid: 'Pagado', preparing: 'En preparación', completed: 'Completado', cancelled: 'Cancelado', refunded: 'Reembolsado' };
export default function ApiSellerPage() {
  const { t } = useTranslation();
  const { user, ownedShop, openShop, navigate } = useApp();
  const [state, setState] = useState({ items: [], orders: [], pending: true, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setState(current => ({ ...current, pending: true, error: '' }));
    Promise.all([sellerService.listAllItems(), sellerService.listAllOrders()]).then(([items, orders]) => { if (active) setState({ items, orders, pending: false, error: '' }); }).catch(error => { if (active) setState({ items: [], orders: [], pending: false, error: error.message }); });
    return () => { active = false; };
  }, [user.id, revision]);
  return <><PageHeading eyebrow={t("CUENTA DE VENDEDOR")} title={t('Hola, {{name}}', {name: user.name.split(' ')[0]})} description={t("Tu sucursal, productos y pedidos.")} /><MerchantSummary shop={ownedShop}><Button variant="quiet" onClick={() => openShop(ownedShop.id)}>{t("Ver tienda")}</Button></MerchantSummary>
    <Button variant="secondary" className="wide space-top" onClick={() => navigate('createStore')}>{t('Editar mi tienda')}</Button>
    <Button variant="secondary" className="wide space-top" icon="ticket" onClick={() => navigate('sellerCoupons')}>{t('Cupones de mi tienda')}</Button>
    {state.pending && <p role="status" className="caption">{t("Cargando tu negocio…")}</p>}{state.error && <div role="alert"><p>{state.error}</p><Button onClick={() => setRevision(value => value + 1)}>{t("Reintentar")}</Button></div>}
    <SectionHeading title={t('Productos · {{count}}', {count: state.items.length})} /><div className="seller-product-list">{state.items.map(item => <SellerProductCard key={item.id} item={item} currency={ownedShop.currency} onEdit={id => navigate(`sellerProduct/${id}`)} />)}</div>
    <SectionHeading title={t('Pedidos · {{count}}', {count: state.orders.length})} />{state.orders.map(order => <article className="surface information-card" key={order.id}><h2>{t('Pedido {{number}}', {number: order.number || order.id})}</h2><p>{t(labels[order.status] || order.status)}</p><b>{money(minorToMajor(order.totalAmount, order.currency), order.currency)}</b></article>)}
    {!state.pending && !state.error && !state.orders.length && <p className="caption">{t("Aún no hay pedidos para esta sucursal.")}</p>}
  </>;
}
