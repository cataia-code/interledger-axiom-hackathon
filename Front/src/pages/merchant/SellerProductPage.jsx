import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { DATA_SOURCE, resolveImageURL } from '../../services/api/client';
import { sellerService } from '../../services/seller/sellerService';
import { productPriceInput, productPriceAmount } from '../../lib/productPrice';
import PageHeading, { SectionHeading } from '../../components/ui/PageHeading';
import CoverImage from '../../components/shops/CoverImage';
import { Button } from '../../components/ui/Button';

function itemForm(item, currency) {
  return { sku: item.sku || '', name: item.name || '', description: item.description || '',
    price: productPriceInput(item.priceAmount, currency),
    categoryId: item.categoryId == null ? '' : String(item.categoryId), status: item.status || 'draft' };
}
export default function SellerProductPage() {
  const { t } = useTranslation();
  const { param, ownedShop, user, navigate, notify, refreshStores } = useApp();
  const [state, setState] = useState({ pending: true, item: null, categories: [], categoryError: false, error: '' });
  const [form, setForm] = useState(null);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [fileError, setFileError] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const currency = state.item?.currency || ownedShop?.currency;
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (DATA_SOURCE !== 'api') { setState({ pending: false, item: null, categories: [], error: 'La edición de productos requiere el modo API.' }); return; }
    const controller = new AbortController();
    setState({ pending: true, item: null, categories: [], categoryError: false, error: '' });
    setForm(null); setFile(null); setError(''); setFileError('');
    Promise.allSettled([
      sellerService.getItem(param, { signal: controller.signal }),
      sellerService.getCategories({ signal: controller.signal }),
    ]).then(([detail, categories]) => {
      if (controller.signal.aborted) return;
      if (detail.status === 'rejected') throw detail.reason;
      const item = detail.value.item;
      if (!item || String(item.id) !== String(param) || (ownedShop && String(item.storeId) !== String(ownedShop.id))) throw new Error('El producto no pertenece a tu sucursal.');
      const itemCurrency = item.currency || ownedShop?.currency;
      const nextForm = itemForm(item, itemCurrency);
      setState({ pending: false, item, categories: categories.status === 'fulfilled' ? categories.value.categories || [] : [], categoryError: categories.status === 'rejected', error: '' });
      setForm(nextForm);
    }).catch(cause => { if (!controller.signal.aborted) setState({ pending: false, item: null, categories: [], error: cause.message }); });
    return () => controller.abort();
  }, [param, user.id, ownedShop?.id, ownedShop?.currency, revision]);
  const busy = saving || uploading;
  const images = [...(state.item?.images || [])].sort((a, b) => a.position - b.position);
  function change(event) { setError(''); setForm(current => ({ ...current, [event.target.name]: event.target.value })); }
  async function save(event) {
    event.preventDefault();
    if (busy || !state.item || !form) return;
    const priceAmount = productPriceAmount(form.price, currency);
    if (priceAmount == null) { setError(t('Introduce un precio válido, sin separadores de miles.')); return; }
    if (!form.name.trim() || !form.sku.trim()) { setError(t('El nombre y el SKU son obligatorios.')); return; }
    const categoryId = form.categoryId === '' ? null : Number(form.categoryId);
    const body = { name: form.name.trim(), sku: form.sku.trim(), description: form.description.trim(), priceAmount, status: form.status };
    if (!state.categoryError) body.categoryId = categoryId;
    setSaving(true); setError('');
    try {
      await sellerService.updateItem(param, body);
      notify(t('Producto actualizado.'));
      refreshStores().catch(() => {});
      navigate('seller');
    } catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  }
  function chooseImage(event) {
    const selected = event.target.files?.[0]; setFile(null); setFileError('');
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setFileError(t('Elige una imagen JPG, PNG o WebP.')); return; }
    if (selected.size > 5 * 1024 * 1024) { setFileError(t('La imagen no puede superar los 5 MB.')); return; }
    setFile(selected);
  }
  async function upload() {
    if (!file || busy || images.length >= 8) return;
    setUploading(true); setFileError(''); let uploaded = false;
    try {
      await sellerService.uploadItemImage(param, file); uploaded = true;
      setFile(null); setFileInputKey(key => key + 1);
      notify(t('Imagen guardada.'));
      refreshStores().catch(() => {});
      const { item } = await sellerService.getItem(param);
      setState(current => ({ ...current, item }));
    } catch (cause) { setFileError(uploaded ? t('La imagen se guardó, pero no pudimos actualizar la vista. Vuelve al listado para verla.') : cause.message); }
    finally { setUploading(false); }
  }
  return <><PageHeading eyebrow="TU CATÁLOGO" title="Editar producto" description="Actualiza la información que ven tus clientes." onBack={busy ? undefined : () => navigate('seller')} />
    {state.pending ? <p role="status">{t('Cargando producto…')}</p> : state.error ? <div role="alert"><p>{t(state.error)}</p><Button onClick={() => setRevision(value => value + 1)}>{t('Reintentar')}</Button></div> : form && <>
      <SectionHeading title="Imágenes del producto" /><div className="seller-product-images">{images.length ? images.map(image => <CoverImage key={`${image.id}:${image.url}`} src={resolveImageURL(image.url)} fallback="/assets/product-image-fallback.svg" alt={state.item.name} />) : <CoverImage fallback="/assets/product-image-fallback.svg" alt={t('Producto sin imagen')} />}</div>
      <section className="surface seller-product-upload"><label htmlFor="product-image">{t('Agregar imagen')}<input key={fileInputKey} id="product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} disabled={busy || images.length >= 8} /></label><small>{t('JPG, PNG o WebP · máximo 5 MB · hasta 8 imágenes.')}</small>{preview && <img src={preview} className="seller-product-preview" alt={t('Vista previa de la nueva imagen')} />}{file && <Button variant="secondary" onClick={upload} disabled={busy}>{uploading ? t('Subiendo imagen…') : t('Subir imagen')}</Button>}{fileError && <p className="field-error" role="alert">{fileError}</p>}</section>
      <form className="account-form seller-product-form" onSubmit={save}><fieldset disabled={busy}>
        <label htmlFor="product-name">{t('Nombre del producto')}<input id="product-name" name="name" value={form.name} onChange={change} required /></label>
        <label htmlFor="product-sku">SKU<input id="product-sku" name="sku" value={form.sku} onChange={change} required /></label>
        <label htmlFor="product-description">{t('Descripción')}<textarea id="product-description" name="description" value={form.description} onChange={change} rows="4" /></label>
        <label htmlFor="product-price">{t('Precio de lista')} · {currency}<input id="product-price" name="price" value={form.price} onChange={change} inputMode="decimal" required aria-describedby="product-price-help" /></label><small id="product-price-help">{t('Escribe el precio sin separadores de miles. La moneda pertenece a tu sucursal.')}</small>
        <label htmlFor="product-category">{t('Categoría')}<select id="product-category" name="categoryId" value={form.categoryId} onChange={change} disabled={state.categoryError}><option value="">{t('Sin categoría')}</option>{form.categoryId && !state.categories.some(category => String(category.id) === form.categoryId) && <option value={form.categoryId}>{t('Categoría actual')}</option>}{state.categories.map(category => <option key={category.id} value={String(category.id)}>{category.name}</option>)}</select></label>{state.categoryError && <p className="caption">{t('No pudimos cargar las categorías. Se conservará la categoría actual.')}</p>}
        <label htmlFor="product-status">{t('Estado')}<select id="product-status" name="status" value={form.status} onChange={change}>{[['draft', 'Borrador'], ['active', 'Activo'], ['inactive', 'Inactivo']].map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label><small>{t('Solo los productos activos aparecen en el catálogo público.')}</small>
        {state.item.available != null && <p className="caption">{t('Unidades disponibles')}: {state.item.available}</p>}
      </fieldset>{error && <p className="field-error" role="alert">{error}</p>}<Button type="submit" className="wide" disabled={busy}>{saving ? t('Guardando…') : t('Guardar cambios')}</Button><Button variant="quiet" className="wide" disabled={busy} onClick={() => navigate('seller')}>{t('Cancelar')}</Button></form>
    </>}
  </>;
}
