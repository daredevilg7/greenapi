import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ChatSession } from '../chat/session';
import { Dialog } from './Dialog';

export function NewChat({ session, onClose }: { session: ChatSession; onClose(): void }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(''); setBusy(true);
    try { await session.createChat(phone, name); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Не удалось создать чат.'); }
    finally { setBusy(false); }
  };
  return <Dialog title="Новый чат" onClose={() => { if (!busy) onClose(); }}><p className="dialog-description">Напишите человеку по номеру телефона.</p><form className="new-chat-form" onSubmit={submit}>
    <label htmlFor="recipient-phone">Номер телефона</label><input id="recipient-phone" type="tel" autoComplete="tel" placeholder="+7 (999) 123-45-67" value={phone} onChange={event => setPhone(event.target.value)} required disabled={busy} /><p className="field-hint">Номер России или Беларуси: +7 или +375.</p>
    <label htmlFor="recipient-name">Имя <span>необязательно</span></label><input id="recipient-name" autoComplete="off" placeholder="Как подписать контакт" value={name} onChange={event => setName(event.target.value)} maxLength={60} disabled={busy} />
    {error && <p role="alert" className="form-error">{error}</p>}<button type="submit" className="primary-button" disabled={busy}>{busy && <LoaderCircle size={17} className="spin" />}{busy ? 'Проверяем номер…' : 'Создать чат'}</button>
    {session.isDemo && <p className="field-hint demo-hint">Демонстрация: номер не проверяется в MAX.</p>}
  </form></Dialog>;
}
