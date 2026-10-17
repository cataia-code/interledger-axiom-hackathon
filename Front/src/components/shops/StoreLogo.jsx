export default function StoreLogo({ shop, className = '', ...props }) {
  return <img className={`store-logo ${className}`} src={shop.logo} alt={`Logo de ${shop.name}`} width="80" height="80" {...props} />;
}
