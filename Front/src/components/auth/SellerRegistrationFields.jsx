import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../ui/Icon';
export default function SellerRegistrationFields({ values, onChange }) {
  const { t } = useTranslation();
  const fields = [
    ['legalName', 'Razón social', 2, 120], ['tradeName', 'Nombre comercial · opcional', 0, 120],
    ['taxId', 'Identificación fiscal', 3, 40], ['organizationLegalId', 'Registro legal de la organización', 3, 40],
    ['country', 'País · código ISO de 2 letras', 2, 2], ['legalAddress', 'Dirección legal', 5, 200],
    ['storeName', 'Nombre de la sucursal', 2, 80], ['storeLegalId', 'Registro legal de la sucursal', 3, 40],
    ['storeAddress', 'Dirección de la sucursal', 5, 200], ['storeCity', 'Ciudad', 2, 80],
  ];
  return <fieldset className="seller-registration"><legend>{t("Tu organización y sucursal")}</legend><p className="caption">{t("La cuenta de vendedor se crea junto con estos datos. La moneda de la sucursal no podrá cambiarse después.")}</p>
    {fields.map(([name, label, min, max]) => <label htmlFor={`seller-${name}`} key={name}>{t(label)}<input id={`seller-${name}`} name={name} required={min > 0} minLength={min || undefined} maxLength={max} value={values[name]} onChange={onChange} /></label>)}
    <div className="seller-receiving-wallet"><div className="wallet-form-heading"><span className="wallet-icon-tile"><Icon name="wallet" /></span><div><h2>{t('Recibe tus pagos')}</h2><p>{t('Configura la wallet y la moneda de tu tienda.')}</p></div></div>
      <label htmlFor="seller-currency">{t('Moneda para recibir pagos')}<select id="seller-currency" name="storeCurrency" required value={values.storeCurrency} onChange={onChange}><option value="COP">{t("COP · Peso colombiano")}</option><option value="USD">{t("USD · Dólar estadounidense")}</option></select></label>
      <label htmlFor="seller-receiving-address">{t('Wallet de tu tienda · Open Payments')}<input id="seller-receiving-address" name="storeWalletAddress" type="text" required value={values.storeWalletAddress} onChange={onChange} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="$ilp.interledger-test.dev/tu-tienda" aria-describedby="seller-receiving-help" /></label>
      <small id="seller-receiving-help">{t('Ingresa el Payment Pointer o la dirección HTTPS de la wallet donde quieres recibir. Open Payments calcula la conversión al pagar.')}</small>
    </div>
    <label htmlFor="seller-latitude">{t("Latitud")}<input id="seller-latitude" name="latitude" type="number" step="any" min="-90" max="90" required value={values.latitude} onChange={onChange} /></label>
    <label htmlFor="seller-longitude">{t("Longitud")}<input id="seller-longitude" name="longitude" type="number" step="any" min="-180" max="180" required value={values.longitude} onChange={onChange} /></label>
  </fieldset>;
}
