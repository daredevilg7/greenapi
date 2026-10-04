import { BatteryFull, Signal, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export function IPhoneFrame({ children, miniature = false }: { children: ReactNode; miniature?: boolean }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    if (miniature) return;
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })), 60_000);
    return () => clearInterval(timer);
  }, [miniature]);
  return <div className={`iphone ${miniature ? 'iphone-mini' : ''}`} aria-label={miniature ? undefined : 'iPhone 17'}>
    <i className="phone-key phone-key-action" /><i className="phone-key phone-key-volume-up" /><i className="phone-key phone-key-volume-down" /><i className="phone-key phone-key-power" />
    <div className="iphone-screen">
      <div className="ios-status" aria-hidden="true"><span>{miniature ? '9:41' : time}</span><div className="dynamic-island"><i /></div><span className="ios-indicators"><Signal /><Wifi /><BatteryFull /></span></div>
      <div className="iphone-content">{children}</div>
      <div className="ios-home" aria-hidden="true"><i /></div>
    </div>
  </div>;
}
