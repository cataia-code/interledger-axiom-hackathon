import { forwardRef, useImperativeHandle } from 'react';
import { useStoreMap } from '../../hooks/useStoreMap';
import { Button } from '../ui/Button';
import Icon from '../ui/Icon';
const StoreMap = forwardRef(function StoreMap(props, ref) {
  const { containerRef, status, center, retry } = useStoreMap(props);
  useImperativeHandle(ref, () => ({ center }), [center]);
  return <><div ref={containerRef} className="store-map" aria-label="Mapa de tiendas en Medellín" />
    {status === 'loading' && <div className="map-loading" role="status"><Icon name="globe" /><span>Buscando lo local…</span></div>}
    {status === 'error' && <div className="map-loading" role="alert"><Icon name="pin" /><span>No pudimos cargar el mapa. Revisa tu conexión.</span><Button variant="secondary" onClick={retry}>Reintentar</Button></div>}
  </>;
});
export default StoreMap;
