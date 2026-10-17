import { useState } from 'react';
import Icon from '../ui/Icon';

const DEFAULT_COVER = '/assets/store-cover-fallback.svg';
export default function CoverImage({ src, fallback, alt, className = '', ...props }) {
  const [failedSources, setFailedSources] = useState([]);
  const source = [src, fallback, DEFAULT_COVER].find(value => value && !failedSources.includes(value));
  if (!source) return <span className={`media-placeholder ${className}`} role="img" aria-label={alt}><Icon name="shop" /></span>;
  return <img className={className} src={source} alt={alt} onError={() => setFailedSources(current => [...current, source])} {...props} />;
}
