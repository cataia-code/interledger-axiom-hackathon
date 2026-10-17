import StoreLogo from '../shops/StoreLogo';
import Rating from '../ui/Rating';
import { Button } from '../ui/Button';
import { money } from '../../lib/currency';
export default function MapShopSheet({ shop, onOpen }) {
  return <article className="map-shop-sheet" key={shop.id}><StoreLogo shop={shop} /><div className="map-shop-sheet__body"><h2>{shop.name}</h2><div><span>{shop.category}</span><Rating value={shop.rating} reviews={shop.reviews} /></div><p>{shop.area}</p><footer><b>Desde {money(shop.price)}</b><Button variant="wine" icon="arrowRight" onClick={() => onOpen(shop.id)}>Ver tienda</Button></footer></div></article>;
}
