import { useApp } from '../../context/AppContext';
import PageHeading, { SectionHeading } from '../../components/ui/PageHeading';
import FilterChips from '../../components/ui/FilterChips';
import Toggle from '../../components/ui/Toggle';
import Icon from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
export default function ScheduledPaymentsPage() {
  const { navigate, schedule, setSchedule, notify } = useApp();
  const update = patch => setSchedule(current => ({ ...current, ...patch }));
  return <><PageHeading eyebrow="TU NEGOCIO" title="Pagos programados" description="Recibe automáticamente tus fondos con la frecuencia que elijas." onBack={() => navigate('seller')} />
    <div className="surface setting-row setting-row--padded"><b>Activar pagos programados</b><Toggle label="Activar pagos programados" checked={schedule.enabled} onChange={enabled => update({ enabled })} /></div>
    <SectionHeading title="Frecuencia" /><FilterChips options={['Diaria', 'Semanal', 'Mensual']} value={schedule.frequency} onChange={frequency => update({ frequency })} label="Frecuencia de los pagos" />
    <label className="surface setting-row setting-row--padded"><b>Monto mínimo</b><select value={schedule.minimum} onChange={event => update({ minimum: Number(event.target.value) })}>{[25, 50, 75, 100].map(value => <option key={value} value={value}>{value} USD</option>)}</select></label>
    <p className="caption">Cuando tu saldo alcance este monto, se programará el abono a tu cuenta bancaria.</p><SectionHeading title="Cuenta de destino" />
    <div className="surface bank-account"><Icon name="bank" /><span><b>Bancolombia</b><small>Cuenta terminada en 1234</small></span></div>
    <div className="info-box"><Icon name="info" /><span>Configuración de demostración. Los abonos bancarios se conectarán en una siguiente etapa.</span></div><Button className="wide" icon="check" onClick={() => notify('Configuración de pagos guardada para esta sesión.')}>Guardar cambios</Button>
  </>;
}
