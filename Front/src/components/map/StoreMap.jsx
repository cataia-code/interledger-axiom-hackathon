import { useTranslation } from '../../i18n/useTranslation';
import { forwardRef, useImperativeHandle } from 'react';
import { useStoreMap } from '../../hooks/useStoreMap';
import { Button } from '../ui/Button';
import Icon from '../ui/Icon';
const StoreMap = forwardRef(function StoreMap(props, ref) {
  const { t } = useTranslation();
  const { containerRef, status, center, centerOn, retry } = useStoreMap(props);
  useImperativeHandle(ref, () => ({ center, centerOn }), [center, centerOn]);
  return <><div ref={containerRef} className="store-map" aria-label={t("Mapa de tiendas en Medellín")} />
    {status === 'loading' && <div className="map-loading" role="status"><Icon name="globe" /><span>{t("Buscando lo local…")}</span></div>}
    {status === 'error' && <div className="map-loading" role="alert"><Icon name="pin" /><span>{t("No pudimos cargar el mapa. Revisa tu conexión.")}</span><Button variant="secondary" onClick={retry}>{t("Reintentar")}</Button></div>}
  </>;
});
export default StoreMap;
