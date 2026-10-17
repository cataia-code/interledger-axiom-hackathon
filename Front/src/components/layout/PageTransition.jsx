// Keying the content restarts its CSS entrance without an overlay intercepting taps.
export default function PageTransition({ routeKey, className, children }) {
  return <div key={routeKey} className={`screen-page ${className}`}>{children}</div>;
}
