import { useRef } from 'react';
import Icon from '../ui/Icon';
export default function StoreMediaField({ label, value, onChange, kind = 'logo', onError }) {
  const ref = useRef(null);
  async function handleFile(event) {
    const file = event.target.files[0]; if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) { onError('Elige una imagen JPG, PNG, WebP o SVG.'); return; }
    if (file.size > (kind === 'logo' ? 750000 : 1500000)) { onError(`La imagen debe pesar menos de ${kind === 'logo' ? '750 KB' : '1,5 MB'}.`); return; }
    const reader = new FileReader(); reader.onload = () => { onError(''); onChange(reader.result); }; reader.onerror = () => onError('No pudimos leer esa imagen. Prueba con otra.'); reader.readAsDataURL(file);
  }
  return <div className={`store-media-field store-media-field--${kind}`}><span>{label}</span><button type="button" onClick={() => ref.current?.click()} aria-label={`Subir ${label.toLowerCase()}`}>{value ? <img src={value} alt={`Vista previa: ${label}`} /> : <><Icon name={kind === 'logo' ? 'shop' : 'culture'} /><small>{kind === 'logo' ? 'Subir logo' : 'Agregar foto de portada'}</small></>}</button><input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleFile} className="visually-hidden" /></div>;
}
