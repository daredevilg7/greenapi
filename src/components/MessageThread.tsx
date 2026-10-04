import { ArrowDown, Check, CheckCheck, ChevronLeft, Clock3, EllipsisVertical, MessageCircle, Phone, Search, TriangleAlert, Video, X } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { Chat, ChatState, Message, MessageStatus } from '../chat/types';
import type { ChatSession } from '../chat/session';
import { Avatar, demoSenderAvatar } from './Avatar';
import { Composer } from './Composer';

const statusLabels: Record<MessageStatus, string> = { sending: 'Отправляется', sent: 'В очереди на отправку', delivered: 'Доставлено', read: 'Прочитано', failed: 'Не отправлено', uncertain: 'Отправка не подтверждена' };

function Status({ status }: { status: MessageStatus }) {
  const Icon = status === 'sending' ? Clock3 : status === 'failed' || status === 'uncertain' ? TriangleAlert : status === 'sent' ? Check : CheckCheck;
  return <span className={`message-status status-${status}`} aria-label={statusLabels[status]} title={statusLabels[status]}><Icon size={17} /></span>;
}

function dateLabel(timestamp: number) {
  const date = new Date(timestamp), today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props { chat?: Chat; state: ChatState; session: ChatSession; draft: string; onDraft(text: string): void; onBack(): void; onNew(): void; onSettings(): void; onRetry(message: Message, chatId: string): void }

export function MessageThread({ chat, state, session, draft, onDraft, onBack, onNew, onSettings, onRetry }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const scrollDimensions = useRef({ height: 0, viewport: 0 });
  const [away, setAway] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const previousChat = useRef<string | undefined>(undefined);
  useEffect(() => {
    const switched = previousChat.current !== chat?.id;
    if (switched) { nearBottom.current = true; setAway(false); setSearching(false); setQuery(''); }
    previousChat.current = chat?.id;
    if (scroller.current && (nearBottom.current || switched || chat?.messages.at(-1)?.direction === 'outgoing')) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [chat?.id, chat?.messages]);
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      scrollDimensions.current = { height: element.scrollHeight, viewport: element.clientHeight };
      if (nearBottom.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [chat?.id]);
  if (!chat) return <section className="message-thread empty-thread wallpaper"><div className="empty-thread-content"><div className="empty-thread-icon"><MessageCircle size={39} strokeWidth={1.5} /></div><h2>Начните разговор</h2><p>Выберите чат слева или напишите<br />человеку по номеру телефона.</p><button className="primary-button" onClick={onNew}>Создать чат</button></div></section>;
  const messages = chat.messages.filter(message => !query || message.text.toLowerCase().includes(query.toLowerCase()));
  return <section className="message-thread" aria-label={`Переписка: ${chat.name}`}>
    <header className="thread-header"><button className="icon-button thread-back" aria-label="Назад к чатам" onClick={onBack}><ChevronLeft size={26} /></button><Avatar name={chat.name} avatar={chat.avatar} color={chat.color} small /><div className="thread-contact"><h2>{chat.name}</h2><p>{session.isDemo && chat.id === 'demo-corporate' ? '12 из 35 в сети' : 'личный чат'}</p></div><div className="thread-header-actions"><button className="icon-button call-control" aria-label="Звонки недоступны в текстовом чате" title="В этом чате доступны текстовые сообщения" disabled><Phone size={22} /></button><button className="icon-button video-control" aria-label="Видеозвонки недоступны в текстовом чате" title="В этом чате доступны текстовые сообщения" disabled><Video size={22} /></button><button className="icon-button search-control" aria-label="Поиск в переписке" aria-expanded={searching} onClick={() => { setSearching(!searching); setQuery(''); }}><Search size={22} /></button><button className="icon-button thread-menu" aria-label="Настройки чата" onClick={onSettings}><EllipsisVertical size={23} /></button></div></header>
    {searching && <div className="thread-search"><Search size={18} /><input aria-label="Поиск сообщений" placeholder="Найти сообщение" autoFocus value={query} onChange={e => setQuery(e.target.value)} /><button className="icon-button" aria-label="Закрыть поиск сообщений" onClick={() => { setSearching(false); setQuery(''); }}><X size={18} /></button></div>}
    <div className="conversation wallpaper">
      {state.error && <div role="status" className="connection-banner"><TriangleAlert size={17} /><span>{state.error}</span><button onClick={onSettings}>Подключение</button></div>}
      <div className="message-scroll" ref={scroller} onScroll={() => { const element = scroller.current!; if (scrollDimensions.current.height !== element.scrollHeight || scrollDimensions.current.viewport !== element.clientHeight) return; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100; setAway(!nearBottom.current); }} tabIndex={0} aria-label="История сообщений">
        <div className="messages" aria-live="polite" aria-relevant="additions text">
          {!messages.length && <div className="conversation-empty"><MessageCircle size={27} /><p>{query ? 'Сообщений не найдено' : 'Напишите первое сообщение'}</p></div>}
          {messages.map((message, index) => {
            const divider = index === 0 || new Date(messages[index - 1].timestamp).toDateString() !== new Date(message.timestamp).toDateString();
            const group = chat.id === 'demo-corporate' && message.direction === 'incoming';
            return <Fragment key={message.id}>{divider && <div className="date-divider"><span>{dateLabel(message.timestamp)}</span></div>}<div className={`message-row ${message.direction} ${group ? 'group-message' : ''}`}>
              {group && <Avatar name={message.senderName || chat.name} avatar={demoSenderAvatar(message.senderName)} color={index % 5} small />}
              <div className={`message-bubble ${message.direction} ${message.status === 'failed' || message.status === 'uncertain' ? 'message-problem' : ''}`}>{group && <strong className="message-author">{message.senderName}</strong>}<p>{message.text}<span className="message-meta-space" /></p><span className="message-meta"><time dateTime={new Date(message.timestamp).toISOString()}>{new Date(message.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time>{message.direction === 'outgoing' && <Status status={message.status} />}</span>
                {['failed', 'uncertain'].includes(message.status) && <div className="message-error"><span>{message.error || 'Сообщение не отправлено.'}</span><button onClick={() => onRetry(message, chat.id)}>Повторить</button></div>}
              </div>
            </div></Fragment>;
          })}
        </div>
      </div>
      {away && <button className="jump-to-bottom" aria-label="К последнему сообщению" onClick={() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; nearBottom.current = true; setAway(false); }}><ArrowDown size={21} /></button>}
      <Composer key={chat.id} chatId={chat.id} session={session} draft={draft} onDraft={onDraft} disabled={state.connection === 'offline'} />
    </div>
  </section>;
}
