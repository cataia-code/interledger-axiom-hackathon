import StoreLogo from './StoreLogo';
import Rating from '../ui/Rating';
export default function MerchantSummary({ shop, children }) {
  return <div className="surface merchant-summary"><StoreLogo shop={shop} /><div><b>{shop.name}</b><small>{shop.area}</small></div>{children ?? <Rating value={shop.rating} />}</div>;
}
