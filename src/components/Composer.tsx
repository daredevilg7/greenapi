import { ArrowUp, LoaderCircle, Mic, Paperclip, Smile } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { ChatSession } from '../chat/session';

const emojis = ['😀', '🙂', '💜', '❤️', '👍', '👋', '✨', '🔥', '🎉', '🌿', '☀️', '😊'];

export function Composer({ chatId, session, draft, onDraft, disabled }: { chatId: string; session: ChatSession; draft: string; onDraft(text: string): void; disabled: boolean }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (input.current) { input.current.style.height = '0px'; input.current.style.height = `${Math.min(input.current.scrollHeight || 24, 112)}px`; }
  }, [draft]);
  useEffect(() => {
    if (!showEmoji) return;
    const close = (event: PointerEvent) => { if (!picker.current?.contains(event.target as Node)) setShowEmoji(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [showEmoji]);
  const send = async () => {
    if (!draft.trim() || busy || disabled) return;
    const text = draft;
    setBusy(true); setError(''); setShowEmoji(false);
    onDraft('');
    try { await session.send(chatId, text); }
    catch (error) { setError(error instanceof Error ? error.message : 'Не удалось отправить сообщение.'); }
    finally { setBusy(false); input.current?.focus(); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void send(); };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') setShowEmoji(false);
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
  };
  const insertEmoji = (emoji: string) => {
    const start = input.current?.selectionStart ?? draft.length;
    const end = input.current?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    if (next.length > 4000) return;
    onDraft(next);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + emoji.length, start + emoji.length); });
  };
  return <div className="composer-area">
    {error && <p className="composer-error" role="alert">{error}</p>}
    <form className={`composer ${draft.trim() ? 'has-draft' : ''}`} onSubmit={submit}><div className="composer-input"><button type="button" className="icon-button attachment-control" aria-label="Вложения недоступны в текстовом чате" title="В тестовом задании доступны текстовые сообщения" disabled><Paperclip /></button><div className="emoji-control" ref={picker}>{showEmoji && <div className="emoji-picker" aria-label="Выбор эмодзи">{emojis.map(emoji => <button type="button" key={emoji} aria-label={`Добавить ${emoji}`} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}<button type="button" className={`icon-button ${showEmoji ? 'active' : ''}`} aria-label="Эмодзи" aria-expanded={showEmoji} onClick={() => setShowEmoji(!showEmoji)} disabled={disabled}><Smile /></button></div>
      <textarea ref={input} aria-label="Сообщение" placeholder="Сообщение" value={draft} onChange={event => onDraft(event.target.value)} onKeyDown={onKey} rows={1} maxLength={4000} disabled={disabled} />
      {draft.length > 3800 && <span className="character-count" aria-live="polite">{draft.length}/4000</span>}
      </div>
      <button className="send-button" type="submit" aria-label="Отправить сообщение" disabled={!draft.trim() || busy || disabled}>{busy ? <LoaderCircle className="spin" size={20} /> : <ArrowUp size={23} strokeWidth={2.4} />}</button>
      {!draft.trim() && <button type="button" className="icon-button voice-control" aria-label="Голосовые сообщения недоступны" title="В тестовом задании доступны текстовые сообщения" disabled><Mic /></button>}
    </form>
    <p className="composer-hint">Enter — отправить · Shift + Enter — новая строка</p>
  </div>;
}
