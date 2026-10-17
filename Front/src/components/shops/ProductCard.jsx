import { IconButton } from '../ui/Button';
import CoverImage from './CoverImage';
import { money } from '../../lib/currency';
export default function ProductCard({ product, cover, onAdd, isFavorite, onFavorite }) {
  return <article className="product-card"><button type="button" className="product-card__add" disabled={!onAdd || product.purchasable === false} onClick={() => onAdd?.(product)} aria-label={`${!onAdd ? 'Ver' : product.purchasable === false ? 'Agotado:' : 'Agregar'} ${product.name}${onAdd && product.purchasable !== false ? ' al carrito' : ''}, ${money(product.price, product.currency || 'COP')}`}><span className="product-card__photo"><CoverImage src={product.photo || cover || product.image} fallback={product.image} alt={product.name} loading="lazy" width="640" height="400" /></span><span className="product-card__body"><span className="product-card__name">{product.name}</span><small>{product.category || 'Producto local'}</small><strong>{money(product.price, product.currency || 'COP')}</strong></span></button>
    {onFavorite && <IconButton icon="heart" label={`${isFavorite ? 'Quitar de' : 'Guardar'} favoritos: ${product.name}`} aria-pressed={isFavorite} className={`product-card__favorite ${isFavorite ? 'is-saved' : ''}`} onClick={() => onFavorite(product.id)} />}
  </article>;
}
