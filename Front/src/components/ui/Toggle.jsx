export default function Toggle({ label, checked, onChange }) {
  return <button className="toggle" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}
