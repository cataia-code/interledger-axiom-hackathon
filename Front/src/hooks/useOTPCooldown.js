import { useEffect, useState } from 'react';
export function useOTPCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time);
      if (time >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return { seconds: Math.max(0, Math.ceil((until - now) / 1000)), start: (seconds = 60) => { const time = Date.now(); setNow(time); setUntil(time + seconds * 1000); } };
}
