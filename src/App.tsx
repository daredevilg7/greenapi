import { ArrowLeft, Check, LogOut, Monitor, PlugZap, Smartphone } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { assetUrl } from './assets';
import { ChatSession } from './chat/session';
import type { Credentials, Device, Message } from './chat/types';
import { Connection } from './components/Connection';
import { DeviceChoice } from './components/DeviceChoice';
import { Dialog } from './components/Dialog';
import { IPhoneFrame } from './components/IPhoneFrame';
import { Messenger } from './components/Messenger';
import { NewChat } from './components/NewChat';

export default function App() {
  const [session] = useState(() => new ChatSession());
  const state = useSyncExternalStore(session.store.subscribe, session.store.getSnapshot);
  const [device, setDevice] = useState<Device | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [modal, setModal] = useState<'new' | 'settings' | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState<{ message: Message; chatId: string } | null>(null);
  useEffect(() => () => session.disconnect(), [session]);
  const connect = async (credentials: Credentials) => {
    await session.connect(credentials);
    if (session.store.getSnapshot().connection === 'connected') { setHasSession(true); setDrafts({}); }
  };
  const demo = () => { session.startDemo(device === 'phone' ? 'demo-corporate' : 'demo-mikhail'); setHasSession(true); setDrafts({}); };
  const logout = () => { session.disconnect(); setHasSession(false); setModal(null); setDrafts({}); setRetry(null); };
  const choose = (next: Device) => { setDevice(next); setModal(null); };
  const content = device && (hasSession ? <Messenger device={device} state={state} session={session} drafts={drafts} onDraft={(id, text) => setDrafts(current => ({ ...current, [id]: text }))} onNew={() => setModal('new')} onSettings={() => setModal('settings')} onDevice={choose} onConnect={logout} onRetry={(message, chatId) => setRetry({ message, chatId })} />
    : <Connection device={device} busy={state.connection === 'connecting'} onConnect={connect} onDemo={demo} />);
  return <>
    {device === null ? <DeviceChoice onChoose={choose} hasSession={hasSession} /> : device === 'phone' ? <main className="phone-stage">
      <header className="stage-header"><button className="stage-back" aria-label="Выбор устройства" onClick={() => setDevice(null)}><ArrowLeft size={17} /><span>MAX</span></button><div className="device-switch" aria-label="Устройство"><button className="selected" aria-label="Телефон" aria-pressed="true" onClick={() => choose('phone')}><Smartphone size={16} /><span>Телефон</span></button><button aria-label="Компьютер" aria-pressed="false" onClick={() => choose('desktop')}><Monitor size={16} /><span>Компьютер</span></button></div><div className="stage-state">{hasSession ? <><span className={`connection-dot ${state.connection}`} /><span>{session.isDemo ? 'Демо' : state.connection === 'connected' ? 'Подключено' : 'Нет соединения'}</span><button onClick={() => session.isDemo ? logout() : setModal('settings')} aria-label={session.isDemo ? 'Подключить GREEN-API' : 'Подключение'}><PlugZap size={17} /></button></> : <span>GREEN-API</span>}</div></header>
      <div className="phone-presentation"><div className="phone-glow" /><IPhoneFrame>{content}</IPhoneFrame></div><footer className="phone-caption"><span>iPhone 17</span><i />{session.isDemo ? 'Демонстрационный режим' : 'Мобильная версия MAX'}</footer>
    </main> : <main className={`desktop-stage ${!hasSession ? 'desktop-connect' : ''}`}>{!hasSession && <><header className="desktop-connection-header"><button className="stage-back" aria-label="Выбор устройства" onClick={() => setDevice(null)}><ArrowLeft size={18} /><img src={assetUrl('max-logo.png')} alt="" /><span>MAX</span></button><button className="text-button" aria-label="Телефон" onClick={() => choose('phone')}><Smartphone size={16} />Телефон</button></header><div className="desktop-connection-wallpaper wallpaper" /></>}{content}</main>}
    {modal === 'new' && <NewChat session={session} onClose={() => setModal(null)} />}
    {modal === 'settings' && <Dialog title="Настройки" onClose={() => setModal(null)}><div className="settings-status"><img src={assetUrl('max-logo.png')} alt="" /><div><strong>{session.isDemo ? 'Демонстрационный режим' : 'MAX через GREEN-API'}</strong><p>{session.isDemo ? 'Сообщения в демо не отправляются в MAX.' : state.connection === 'connected' ? 'Сессия подключена. Ответы приходят автоматически.' : 'Проверьте подключение или войдите заново.'}</p></div></div><h3 className="settings-label">Вид интерфейса</h3><div className="settings-devices"><button className={device === 'phone' ? 'selected' : ''} onClick={() => choose('phone')}><Smartphone size={20} />Телефон{device === 'phone' && <Check size={16} />}</button><button className={device === 'desktop' ? 'selected' : ''} onClick={() => choose('desktop')}><Monitor size={20} />Компьютер{device === 'desktop' && <Check size={16} />}</button></div><p className="settings-copy">Переписка сохранится при смене устройства. При выходе история и ключи будут удалены из этой вкладки.</p><button className={session.isDemo ? 'primary-button' : 'logout-button'} onClick={logout}>{session.isDemo ? <><PlugZap size={18} />Подключить GREEN-API</> : <><LogOut size={18} />Выйти из аккаунта</>}</button><a className="settings-doc-link" href="https://green-api.com/v3/docs/api/receiving/technology-http-api/" target="_blank" rel="noreferrer">Как настроить получение сообщений</a></Dialog>}
    {retry && <Dialog title="Повторить отправку?" onClose={() => setRetry(null)}><p className="dialog-description">{retry.message.status === 'uncertain' ? 'GREEN-API мог принять сообщение, даже если ответ не дошёл. Проверьте чат в MAX, чтобы не отправить его дважды.' : 'Текст будет снова отправлен получателю.'}</p><blockquote className="retry-text">{retry.message.text}</blockquote><button className="primary-button" onClick={() => { const current = retry; setRetry(null); void session.send(current.chatId, current.message.text); }}>Отправить ещё раз</button></Dialog>}
  </>;
}
