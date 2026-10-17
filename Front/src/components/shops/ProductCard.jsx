import { Button, IconButton } from '../ui/Button';
import CoverImage from './CoverImage';
import { money } from '../../lib/currency';
export default function ProductCard({ product, cover, onAdd, isFavorite, onFavorite }) {
  return <article className="product-card"><div className="product-card__photo"><CoverImage src={product.photo || cover || product.image} alt={`Foto de ${product.name}`} loading="lazy" width="640" height="400" />
    {onFavorite && <IconButton icon="heart" label={`${isFavorite ? 'Quitar de' : 'Guardar'} favoritos: ${product.name}`} aria-pressed={isFavorite} className={isFavorite ? 'is-saved' : ''} onClick={() => onFavorite(product.id)} />}</div>
    <div className="product-card__body"><h3>{product.name}</h3><small>{product.category || 'Producto local'}</small><strong>{money(product.price)}</strong>{onAdd && <Button variant="quiet" icon="bag" onClick={() => onAdd(product)}>Agregar al carrito</Button>}</div>
  </article>;
}
