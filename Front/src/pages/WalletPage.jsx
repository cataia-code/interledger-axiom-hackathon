import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { useApp } from '../context/AppContext';
import PageHeading, { SectionHeading } from '../components/ui/PageHeading';
import { Button } from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import PurchaseCard from '../components/payments/PurchaseCard';
import { purchaseState } from '../lib/purchaseState';

const filters = [{ id: 'all', label: 'Todas' }, { id: 'paid', label: 'Pagadas' }, { id: 'pending', label: 'Pendientes' }, { id: 'incomplete', label: 'No completadas' }];
export default function WalletPage() {
  const { t } = useTranslation();
  const { navigate, payments, purchasesLoading, purchasesError, refreshPurchases, findShop } = useApp();
  const [filter, setFilter] = useState('all');
  useEffect(() => { refreshPurchases(); }, [refreshPurchases]);
  const ordered = useMemo(() => [...payments].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), [payments]);
  const visible = ordered.filter(purchase => filter === 'all' || purchaseState(purchase).group === filter);
  const pendingCount = ordered.filter(purchase => purchaseState(purchase).group === 'pending').length;
  return <><PageHeading eyebrow={t('TU RECORRIDO LOCAL')} title={t('Mis compras')} description={t('Historial de compras y pagos.')} onBack={() => navigate('profile')} />
    {pendingCount > 0 && <p className="purchase-pending-note"><Icon name="info" />{t('{{count}} pendientes de confirmación', { count: pendingCount })}</p>}
    <SectionHeading title={t('Historial de pedidos')}><Button variant="quiet" disabled={purchasesLoading} onClick={refreshPurchases}>{t(purchasesLoading ? 'Actualizando…' : 'Actualizar')}</Button></SectionHeading>
    <div className="purchase-filters" role="group" aria-label={t('Filtrar compras por estado')}>{filters.map(option => <button key={option.id} aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{t(option.label)}</button>)}</div>
    {purchasesError && <p className="field-error" role="alert">{t(purchasesError)} {payments.length > 0 && t('Los estados mostrados pueden estar desactualizados.')}</p>}
    {purchasesLoading && <p className="caption" role="status">{t('Cargando compras…')}</p>}
    {visible.length > 0 && <ul className="surface purchase-history" aria-busy={purchasesLoading}>{visible.map(purchase => <li key={purchase.orderId || purchase.id || purchase.date}><PurchaseCard purchase={purchase} shop={findShop(purchase.shopId)} /></li>)}</ul>}
    {!purchasesLoading && !purchasesError && !visible.length && <div className="surface information-card"><Icon name="receipt" /><p>{t(payments.length ? 'No hay pedidos con este estado.' : 'Aún no tienes pedidos. Descubre una tienda para comenzar.')}</p></div>}
    <Button className="wide space-top" icon="arrowRight" onClick={() => navigate('home/map')}>{t('Descubrir tiendas')}</Button>
  </>;
}
