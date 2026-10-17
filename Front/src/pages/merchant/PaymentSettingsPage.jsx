import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import PageHeading, { SectionHeading } from '../../components/ui/PageHeading';
import Toggle from '../../components/ui/Toggle';
import { Button } from '../../components/ui/Button';
export default function PaymentSettingsPage() {
  const { navigate, schedule, setSchedule, notify } = useApp();
  const [notifications, setNotifications] = useState({ 'Pago realizado': true, 'Saldo mínimo': true, 'Errores de pago': true });
  return <><PageHeading eyebrow="CONFIGURACIÓN" title="Pagos y notificaciones" description="Administra cómo recibes tus pagos." onBack={() => navigate('seller')} />
    <SectionHeading title="Pagos programados"><Button variant="quiet" onClick={() => navigate('scheduled')}>Editar</Button></SectionHeading><div className="surface information-card">
      <div className="setting-row"><b>Pagos programados</b><Toggle label="Pagos programados" checked={schedule.enabled} onChange={enabled => setSchedule(current => ({ ...current, enabled }))} /></div>
      <div className="setting-row"><span>Monto mínimo</span><b>{schedule.minimum} USD</b></div><div className="setting-row"><span>Frecuencia</span><b>{schedule.frequency}</b></div><div className="setting-row"><span>Cuenta de destino</span><b>Bancolombia · 1234</b></div>
    </div><SectionHeading title="Notificaciones" /><div className="surface information-card">{Object.entries(notifications).map(([label, checked]) => <div className="setting-row" key={label}><span>{label}</span><Toggle label={label} checked={checked} onChange={value => setNotifications(current => ({ ...current, [label]: value }))} /></div>)}</div>
    <Button variant="outline" className="wide space-top" disabled={!schedule.enabled} onClick={() => { setSchedule(current => ({ ...current, enabled: false })); notify('Pagos programados desactivados.'); }}>Desactivar pagos programados</Button>
  </>;
}
