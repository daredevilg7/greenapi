import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const selector = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
    const firstInput = panel.current?.querySelector<HTMLInputElement>('input');
    (firstInput || panel.current?.querySelector<HTMLElement>(selector))?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const elements = [...(panel.current?.querySelectorAll<HTMLElement>(selector) || [])];
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby={id} ref={panel}><header><h2 id={id}>{title}</h2><button className="icon-button" aria-label="Закрыть окно" onClick={onClose}><X /></button></header>{children}</div></div>;
}
