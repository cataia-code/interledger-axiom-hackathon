import { useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from './Button';
import Icon from './Icon';
export function Toast() {
  const { toast } = useApp();
  return <div className={`toast ${toast ? 'is-visible' : ''}`} role="status" aria-live="polite"><Icon name="check" /><span>{toast}</span></div>;
}
export function AppDialog() {
  const { dialog, setDialog } = useApp(); const ref = useRef(null);
  useEffect(() => { if (dialog) ref.current?.showModal(); else ref.current?.close(); }, [dialog]);
  return <dialog ref={ref} className="app-dialog" onCancel={() => setDialog(null)} onClick={event => { if (event.target === event.currentTarget) setDialog(null); }}>
    <div className="dialog-content"><span className="eyebrow">LOKORA</span><h2>{dialog?.title}</h2><p>{dialog?.description}</p><Button className="wide" onClick={() => setDialog(null)}>Entendido</Button></div>
  </dialog>;
}
