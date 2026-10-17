import { useState } from 'react';
const FALLBACK = '/assets/store-logo-fallback.svg';
export default function StoreLogo({ shop, className = '', ...props }) {
  const [failedSource, setFailedSource] = useState(null);
  const source = shop.logo && shop.logo !== failedSource ? shop.logo : FALLBACK;
  return <img className={`store-logo ${className}`} src={source} alt={`Logo de ${shop.name}`} width="80" height="80" onError={() => { if (source !== FALLBACK) setFailedSource(source); }} {...props} />;
}
