import { FolderOpen, MessageCircle, MessagesSquare, Monitor, Phone, Settings, UsersRound } from 'lucide-react';
import { useState } from 'react';
import type { ChatSession } from '../chat/session';
import type { ChatState, Device, Message } from '../chat/types';
import { ChatList } from './ChatList';
import { MessageThread } from './MessageThread';

interface Props { device: Device; state: ChatState; session: ChatSession; drafts: Record<string, string>; onDraft(chatId: string, text: string): void; onNew(): void; onSettings(): void; onDevice(device: Device): void; onConnect(): void; onRetry(message: Message, chatId: string): void }

export function Messenger({ device, state, session, drafts, onDraft, onNew, onSettings, onDevice, onRetry }: Props) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const active = state.chats.find(chat => chat.id === state.activeChatId);
  const unread = state.chats.reduce((sum, chat) => sum + chat.unread, 0);
  return <div className={`messenger messenger-${device} ${active ? 'chat-open' : 'list-open'}`}>
    {device === 'desktop' && <nav className="messenger-rail" aria-label="Навигация">
      <button className={`rail-button ${!unreadOnly ? 'selected' : ''}`} onClick={() => setUnreadOnly(false)}><span className="rail-icon"><MessagesSquare />{state.chats.length > 0 && <b className="count-all">{state.chats.length}</b>}</span><span>Все</span></button>
      <button className={`rail-button ${unreadOnly ? 'selected' : ''}`} onClick={() => setUnreadOnly(true)}><span className="rail-icon"><FolderOpen />{unread > 0 && <b>{unread}</b>}</span><span>Новые</span></button>
      <div className="rail-divider" />
      <button className="rail-button" onClick={onNew}><UsersRound /><span>Контакты</span></button>
      <button className="rail-button" disabled title="В тестовом задании доступны текстовые сообщения"><Phone /><span>Звонки</span></button>
      <div className="rail-spacer" />
      <button className="rail-button" aria-label="Настройки" onClick={onSettings}><Settings /><span>Настройки</span></button>
    </nav>}
    <ChatList state={state} unreadOnly={unreadOnly} onSelect={id => session.store.selectChat(id)} onNew={onNew} />
    <MessageThread chat={active} state={state} session={session} draft={drafts[active?.id || ''] || ''} onDraft={text => { if (active) onDraft(active.id, text); }} onBack={() => session.store.selectChat(null)} onNew={onNew} onSettings={onSettings} onRetry={onRetry} />
    {device === 'phone' && !active && <nav className="phone-tabs" aria-label="Навигация"><button className={!unreadOnly ? 'selected' : ''} onClick={() => setUnreadOnly(false)}><MessageCircle size={22} /><span>Чаты</span></button><button className={unreadOnly ? 'selected' : ''} onClick={() => setUnreadOnly(true)}><FolderOpen size={22} /><span>Новые</span></button><button aria-label="Настройки" onClick={onSettings}><Settings size={22} /><span>Настройки</span></button><button aria-label="Компьютер" onClick={() => onDevice('desktop')}><Monitor size={22} /><span>Компьютер</span></button></nav>}
  </div>;
}
