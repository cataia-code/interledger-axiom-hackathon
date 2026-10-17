import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { resolveImageURL } from '../../services/api/client';
import CoverImage from '../shops/CoverImage';
import Icon from '../ui/Icon';
import { Button } from '../ui/Button';

const imageKinds = {
  icon: { field: 'iconUrl', label: 'Logo de tu tienda', fallback: '/assets/store-logo-fallback.svg' },
  banner: { field: 'bannerUrl', label: 'Foto de portada', fallback: '/assets/store-cover-fallback.svg' },
};
export default function StoreImageEditor({ store, busy = false, onUpload, onDelete }) {
  const { t } = useTranslation();
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [previews, setPreviews] = useState({});
  useEffect(() => { const urls = Object.fromEntries(Object.entries(files).filter(([, file]) => file).map(([kind, file]) => [kind, URL.createObjectURL(file)])); setPreviews(urls); return () => Object.values(urls).forEach(url => URL.revokeObjectURL(url)); }, [files]);
  function choose(kind, event) {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = ''; setFiles(current => ({ ...current, [kind]: null }));
    setErrors(current => ({ ...current, [kind]: '' }));
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setErrors(current => ({ ...current, [kind]: t('Elige una imagen JPG, PNG o WebP.') })); return; }
    if (file.size > 5 * 1024 * 1024) { setErrors(current => ({ ...current, [kind]: t('La imagen no puede superar los 5 MB.') })); return; }
    setFiles(current => ({ ...current, [kind]: file }));
  }
  return <div className="store-media-editors">{Object.entries(imageKinds).map(([kind, config]) => {
    const currentUrl = store?.[config.field]; const file = files[kind]; const preview = previews[kind] || '';
    return <section className={`surface store-media-editor store-media-editor--${kind}`} key={kind}>
      <h2>{t(config.label)}</h2><CoverImage src={preview || resolveImageURL(currentUrl)} fallback={config.fallback} alt={t(config.label)} className="store-media-editor__preview" />
      <label className="button button--secondary store-media-editor__choose" htmlFor={`store-${kind}-file`}><Icon name="culture" />{t(currentUrl ? 'Cambiar imagen' : 'Agregar imagen')}<input id={`store-${kind}-file`} className="store-media-editor__input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => choose(kind, event)} disabled={busy} /></label>
      <small>{t('JPG, PNG o WebP · máximo 5 MB.')}</small>
      {errors[kind] && <p className="field-error" role="alert">{errors[kind]}</p>}
      <div className="store-media-editor__actions">{file && <Button disabled={busy} onClick={async () => { const success = await onUpload(kind, file); if (success) setFiles(current => ({ ...current, [kind]: null })); }}>{t('Guardar imagen')}</Button>}{file && <Button variant="quiet" disabled={busy} onClick={() => setFiles(current => ({ ...current, [kind]: null }))}>{t('Cancelar')}</Button>}{currentUrl && <Button variant="quiet" disabled={busy || Boolean(file)} onClick={() => onDelete(kind)}>{t('Quitar imagen')}</Button>}</div>
    </section>;
  })}</div>;
}
