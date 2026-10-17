export default function BrandLogo({ full = false, className = '' }) {
  return <img className={`brand-logo ${full ? 'brand-logo--full' : ''} ${className}`}
    src="/assets/lokora-brand.png"
    alt="Lokora · go global, grow local" width={full ? 270 : 140} height={full ? 257 : 46} />;
}
