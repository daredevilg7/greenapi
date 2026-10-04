import { ChevronRight, Monitor, Smartphone } from 'lucide-react';
import type { Device } from '../chat/types';
import { assetUrl } from '../assets';

export function DeviceChoice({ onChoose, hasSession }: { onChoose(device: Device): void; hasSession: boolean }) {
  return <main className="device-page">
    <section className="device-selection" aria-labelledby="device-heading">
      <img className="device-logo" src={assetUrl('max-logo.png')} alt="MAX" />
      <h1 id="device-heading">Открыть MAX</h1>
      <p className="device-description">Выберите устройство</p>
      <div className="device-options">
        <button aria-label="Телефон — интерфейс в iPhone 17" onClick={() => onChoose('phone')}><Smartphone size={29} strokeWidth={1.7} /><span><strong>Телефон</strong><small>Мобильный интерфейс в iPhone 17</small></span><ChevronRight size={21} /></button>
        <button aria-label="Компьютер — интерфейс MAX на весь экран" onClick={() => onChoose('desktop')}><Monitor size={29} strokeWidth={1.7} /><span><strong>Компьютер</strong><small>Веб-версия на весь экран</small></span><ChevronRight size={21} /></button>
      </div>
      <p className="device-note">{hasSession ? 'Ваша переписка сохранится.' : 'Для подключения понадобятся данные GREEN-API.'}</p>
    </section>
  </main>;
}
