import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { sellerService } from '../../services/seller/sellerService';
import { resolveImageURL } from '../../services/api/client';
import { minorToMajor } from '../../services/marketplace/itemAdapter';
import { money } from '../../lib/currency';
import CoverImage from '../shops/CoverImage';
import { Button } from '../ui/Button';
export default function SellerProductCard({ item, currency, onEdit }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const hasImages = Array.isArray(item.images);
  useEffect(() => {
    if (hasImages) return;
    const controller = new AbortController();
    sellerService.getItem(item.id, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setDetail(result.item); }).catch(() => {});
    return () => controller.abort();
  }, [item.id, hasImages]);
  const images = hasImages ? item.images : String(detail?.id) === String(item.id) ? detail.images || [] : [];
  const photo = [...images].sort((a, b) => a.position - b.position).map(image => resolveImageURL(image.url)).find(Boolean);
  const status = { active: 'Activo', inactive: 'Inactivo', draft: 'Borrador' }[item.status] || item.status || 'Catálogo';
  return <article className="surface seller-product-card"><CoverImage src={photo} fallback="/assets/product-image-fallback.svg" alt={item.name} className="seller-product-card__photo" loading="lazy" /><div className="seller-product-card__body"><h2>{item.name}</h2><p>{item.sku} · {t(status)}</p><b>{money(minorToMajor(item.priceAmount, item.currency || currency), item.currency || currency)}</b><Button variant="secondary" onClick={() => onEdit(item.id)} aria-label={t('Editar {{name}}', { name: item.name })}>{t('Editar producto')}</Button></div></article>;
}
