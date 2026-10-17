import { useTranslation } from '../../i18n/useTranslation';
import Icon from '../ui/Icon';
export default function AccountIntent({ value, onChange }) {
  const { t } = useTranslation();
  return <fieldset className="account-intent"><legend>{t("Tipo de cuenta")}</legend><div>{[
    ['buy', 'bag', 'Comprar local', 'Descubre tiendas y productos'],
    ['sell', 'shop', 'Vender', 'Gestiona tu tienda'],
  ].map(([id, icon, title, subtitle]) => <label key={id} className={value === id ? 'is-active' : ''}><input type="radio" name="intent" value={id} checked={value === id} onChange={() => onChange(id)} /><Icon name={icon} /><b>{t(title)}</b><small>{t(subtitle)}</small></label>)}</div><p>{t("Compradores y vendedores tienen cuentas y accesos separados.")}</p></fieldset>;
}
