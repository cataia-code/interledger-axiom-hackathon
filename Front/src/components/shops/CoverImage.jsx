import { useState } from 'react';
const FALLBACKS = ['/assets/medellin-mural.png', '/assets/medellin-cultura.png'];
export default function CoverImage({ src, alt, className = '', ...props }) {
  const [fallbackIndex, setFallbackIndex] = useState(-1);
  return <img className={className} src={fallbackIndex < 0 ? src : FALLBACKS[fallbackIndex]} alt={alt} onError={() => setFallbackIndex(current => Math.min(current + 1, FALLBACKS.length - 1))} {...props} />;
}
