import StoreLogo from './StoreLogo';
import CoverImage from './CoverImage';
import Rating from '../ui/Rating';
import Icon from '../ui/Icon';
export default function ShopCard({ shop, onOpen, isFavorite = false, onFavorite }) {
  return <article className="shop-card"><button className="shop-card__open" onClick={() => onOpen(shop.id)} aria-label={`Ver tienda ${shop.name}`}>
    <span className="shop-card__photo"><CoverImage src={shop.cover} alt={`Fachada o productos de ${shop.name}`} loading="lazy" /><StoreLogo shop={shop} className="shop-card__logo" /></span>
    <span className="shop-card__body"><span className="shop-card__title">{shop.name}</span><span className="shop-card__type">{shop.type}</span><span className="shop-card__meta"><span>{shop.distance}</span>{shop.rating > 0 && <Rating value={shop.rating} reviews={shop.reviews} />}</span></span>
  </button>{onFavorite && <button className={`favorite-button ${isFavorite ? 'is-saved' : ''}`} aria-label={`${isFavorite ? 'Quitar de' : 'Guardar en'} favoritos: ${shop.name}`} aria-pressed={isFavorite} onClick={() => onFavorite(shop.id)}><Icon name="heart" /></button>}</article>;
}
