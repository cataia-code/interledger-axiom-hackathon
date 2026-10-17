import { useTranslation } from '../../i18n/useTranslation';
import { useApp } from '../../context/AppContext';
import { Button, IconButton } from '../ui/Button';
import Icon from '../ui/Icon';
import ProductThumbnail from '../shops/ProductThumbnail';
import StoreLogo from '../shops/StoreLogo';
import CartCoupon from '../coupons/CartCoupon';
import { DATA_SOURCE } from '../../services/api/client';
import { money, toUSD, REFERENCE_RATE } from '../../lib/currency';
export default function CartContents({ onNavigate = () => {} }) {
  const { t } = useTranslation();
  const { cartGroups, cartCount, updateQuantity, findShop, openShop, beginCheckout, navigate, cartError, cartPending, clearShopCart } = useApp();
  const currency = cartGroups[0]?.currency || 'COP';
  const mixedCurrencies = cartGroups.some(group => group.currency !== currency);
  const equivalentUSD = value => currency === 'USD' ? value : currency === 'COP' ? toUSD(value) : null;
  const total = cartGroups.reduce((sum, group) => sum + group.total, 0);
  function pay(shop) { onNavigate(); beginCheckout(shop); }
  if (!cartCount) return <div className="empty-state"><Icon name="cart" /><h3>{t("Tu próxima experiencia empieza aquí.")}</h3>{cartError && <p role="alert">{t(cartError)}</p>}{cartPending && <p role="status">{t("Cargando carrito…")}</p>}<p>{t("Toca un producto de una tienda para agregarlo al carrito.")}</p><Button onClick={() => { onNavigate(); navigate('home/list'); }}>Explorar tiendas</Button></div>;
  return <>{cartError && <p className="field-error" role="alert">{t(cartError)}</p>}{cartPending && <p role="status" className="caption">{t("Actualizando carrito…")}</p>}
    <div className="cart-currency-summary"><span>{t("TOTAL DEL CARRITO")}</span>{mixedCurrencies ? <strong>Ver totales por tienda</strong> : <><strong>{money(total, currency)} <small>{currency}</small></strong>{equivalentUSD(total) !== null && currency !== 'USD' && DATA_SOURCE === 'mock' && <b>≈ {money(equivalentUSD(total), 'USD')} USD</b>}</>}<p>{t(DATA_SOURCE === 'api' ? 'Revisa tus productos y el total en la moneda de la tienda.' : 'Pagas en dólares desde tu wallet externa. Cada tienda recibe pesos colombianos.')}</p>{DATA_SOURCE === 'mock' && <small>Tasa de ejemplo: 1 USD = {money(REFERENCE_RATE)} COP. La cotización final se confirma antes de pagar.</small>}</div>
    {DATA_SOURCE === 'api' && <CartCoupon onNavigate={onNavigate} />}
    <p className="cart-drawer__hint">{t('Tu carrito solo admite productos de una tienda. Para comprar en otra, finaliza esta compra o vacía el carrito.')}</p>
    <div className="cart-groups">{cartGroups.map(group => { const shop = findShop(group.shopId); return <section className="cart-group" key={group.shopId}>
      <button className="cart-group__shop" onClick={() => { onNavigate(); openShop(group.shopId); }}>{shop && <StoreLogo shop={shop} />}<b>{shop?.name || 'Comercio local'}</b><Icon name="chevron" /></button>
      {group.items.map(item => <div className="cart-line" key={item.id}><ProductThumbnail productId={item.id} name={item.name} photo={item.photo} /><span className="cart-line__details"><b>{item.name}</b><small>{money(item.price, item.currency || 'COP')} {item.currency || 'COP'} {t('por unidad')}</small>{DATA_SOURCE === 'mock' && <small>≈ {money(toUSD(item.price), 'USD')} USD {t('por unidad')}</small>}<span className="cart-line__subtotal">{money(item.price * item.quantity, group.currency)} {group.currency} {DATA_SOURCE === 'mock' && <small>≈ {money(toUSD(item.price * item.quantity), 'USD')} USD</small>}</span></span>
        <div className="quantity-control"><IconButton icon={item.quantity === 1 ? 'trash' : 'minus'} label={`Quitar una unidad de ${item.name}`} disabled={cartPending} onClick={() => updateQuantity(group.shopId, item.id, item.quantity - 1)} /><output aria-label={`Cantidad de ${item.name}`}>{item.quantity}</output><IconButton icon="plus" label={`Agregar una unidad de ${item.name}`} disabled={cartPending || item.quantity >= 99} onClick={() => updateQuantity(group.shopId, item.id, item.quantity + 1)} /></div>
      </div>)}<footer><span>{t("Total de la tienda")}<b>{money(group.total, group.currency)} {group.currency}</b>{DATA_SOURCE === 'mock' && <small>≈ {money(toUSD(group.total), 'USD')} USD</small>}</span><Button variant="wine" icon="arrowRight" disabled={!shop || cartPending || group.items.some(item => item.purchasable === false) || Boolean(group.couponError)} onClick={() => pay(shop)}>{t("Ir a pagar")}</Button></footer>
    <Button variant="quiet" disabled={cartPending} onClick={() => clearShopCart(group.shopId)}>{t("Vaciar carrito")}</Button></section>; })}</div>
  </>;
}
