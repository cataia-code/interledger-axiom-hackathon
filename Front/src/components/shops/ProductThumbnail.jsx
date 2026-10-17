import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DATA_SOURCE } from '../../services/api/client';
import { marketplaceService } from '../../services/marketplace/marketplaceService';
import CoverImage from './CoverImage';
export default function ProductThumbnail({ productId, name, photo, className = '' }) {
  const { shops } = useApp();
  const id = String(productId);
  const product = shops.flatMap(shop => shop.products).find(item => String(item.id) === id);
  const [loaded, setLoaded] = useState(null);
  const known = Boolean(product);
  useEffect(() => {
    if (photo || known || DATA_SOURCE !== 'api') return;
    const controller = new AbortController();
    marketplaceService.getProduct(id, { signal: controller.signal }).then(item => { if (!controller.signal.aborted) setLoaded({ id, photo: item.photo }); }).catch(() => {});
    return () => controller.abort();
  }, [id, known, photo]);
  const source = photo || product?.photo || (loaded?.id === id ? loaded.photo : '') || (DATA_SOURCE === 'mock' ? product?.image : '');
  return <CoverImage src={source} fallback="/assets/product-image-fallback.svg" alt={source ? name : `Sin foto: ${name}`} className={`product-thumbnail ${className}`} width="64" height="64" loading="lazy" />;
}
