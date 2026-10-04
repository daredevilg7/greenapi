import { ChevronDown, Eye, EyeOff, ExternalLink, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Credentials, Device } from '../chat/types';
import { assetUrl } from '../assets';

interface Props { device: Device; busy: boolean; onConnect(credentials: Credentials): Promise<void>; onDemo(): void }

export function Connection({ device, busy, onConnect, onDemo }: Props) {
  const [id, setId] = useState('');
  const [token, setToken] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    try { await onConnect({ idInstance: id.trim(), apiTokenInstance: token.trim(), apiUrl: apiUrl.trim() || undefined }); }
    catch (error) { setError(error instanceof Error ? error.message : 'Не удалось подключиться.'); }
  };
  return <section className={`connection ${device === 'phone' ? 'connection-mobile' : ''}`} aria-labelledby="connection-heading">
    <img className="connection-logo" src={assetUrl('max-logo.png')} alt="MAX" />
    <h1 id="connection-heading">Подключить MAX</h1><p className="connection-description">Введите данные инстанса GREEN-API</p>
    <form onSubmit={submit} className="connection-form">
      <label htmlFor="instance-id">idInstance</label><input id="instance-id" autoComplete="off" inputMode="numeric" placeholder="Например, 3100123456" value={id} onChange={e => setId(e.target.value)} required disabled={busy} />
      <label htmlFor="instance-token">apiTokenInstance</label><div className="password-field"><input id="instance-token" type={visible ? 'text' : 'password'} autoComplete="off" spellCheck={false} placeholder="Токен вашего инстанса" value={token} onChange={e => setToken(e.target.value)} required disabled={busy} /><button className="icon-button" type="button" aria-label={visible ? 'Скрыть токен' : 'Показать токен'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</button></div>
      <details className="api-settings"><summary>Адрес API <ChevronDown size={15} /></summary><label htmlFor="api-url">apiUrl</label><input id="api-url" type="url" placeholder="https://3100.api.green-api.com" value={apiUrl} onChange={e => setApiUrl(e.target.value)} disabled={busy} /><p>Необязательно. По умолчанию определяется по idInstance.</p></details>
      {error && <div role="alert" className="form-error">{error}</div>}
      <button className="primary-button" disabled={busy} type="submit">{busy && <LoaderCircle className="spin" size={18} />}{busy ? 'Подключаемся…' : 'Подключиться'}</button>
    </form>
    <p className="credential-note">Ключи остаются только в этой вкладке.</p>
    <div className="connection-divider"><span>или</span></div><button className="demo-button" onClick={onDemo} disabled={busy}>Попробовать без подключения</button>
    <a className="connection-help" href="https://console.green-api.com/" target="_blank" rel="noreferrer">Где взять данные? <ExternalLink size={13} /></a>
  </section>;
}
