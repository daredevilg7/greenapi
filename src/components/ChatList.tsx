import { BadgeCheck, CheckCheck, MessageCircle, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { Chat, ChatState } from '../chat/types';
import { Avatar } from './Avatar';

export function ChatList({ state, unreadOnly, onSelect, onNew }: { state: ChatState; unreadOnly: boolean; onSelect(id: string): void; onNew(): void }) {
  const [query, setQuery] = useState('');
  const chats = [...state.chats].filter(chat => (!unreadOnly || chat.unread > 0) && `${chat.name} ${chat.phone || ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.messages.at(-1)?.timestamp ?? 0) - (a.messages.at(-1)?.timestamp ?? 0));
  return <aside className="chat-list" aria-label="Список чатов">
    <header className="chat-list-header"><h1>{unreadOnly ? 'Новые' : 'Чаты'}</h1><button className="new-chat-button" aria-label="Новый чат" title="Новый чат" onClick={onNew}><Plus size={21} /></button></header>
    <div className="chat-search"><Search size={17} /><input aria-label="Поиск чатов" placeholder="Поиск" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={15} /></button>}</div>
    <div className="chat-list-items">{chats.map(chat => <ChatRow key={chat.id} chat={chat} selected={state.activeChatId === chat.id} onSelect={() => onSelect(chat.id)} />)}
      {!chats.length && <div className="list-empty"><MessageCircle size={32} /><h2>{query ? 'Ничего не найдено' : unreadOnly ? 'Всё прочитано' : 'Пока нет чатов'}</h2><p>{query ? 'Попробуйте другое имя или номер.' : unreadOnly ? 'Новые сообщения появятся здесь.' : 'Создайте первый чат по номеру телефона.'}</p>{!query && !unreadOnly && <button className="text-button" onClick={onNew}>Создать первый чат</button>}</div>}
    </div>
    <footer className="chat-list-footer"><span className={`connection-dot ${state.connection}`} />{state.connection === 'demo' ? 'Демонстрационный режим' : state.connection === 'connected' ? 'GREEN-API подключён' : state.connection === 'reconnecting' ? 'Восстанавливаем соединение…' : 'Соединение прервано'}</footer>
  </aside>;
}

function ChatRow({ chat, selected, onSelect }: { chat: Chat; selected: boolean; onSelect(): void }) {
  const last = chat.messages.at(-1);
  return <button className={`chat-row ${selected ? 'selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
    <Avatar name={chat.name} avatar={chat.avatar} color={chat.color} />
    <span className="chat-row-copy"><span className="chat-row-top"><strong>{chat.name}{chat.id === 'demo-max' && <BadgeCheck className="verified-badge" size={14} />}</strong><time>{last ? new Date(last.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}</time></span><span className="chat-row-bottom"><span>{last?.direction === 'outgoing' && <CheckCheck size={16} />} {last?.text || 'Начните общение'}</span>{chat.unread > 0 && <b className="unread-badge">{chat.unread > 99 ? '99+' : chat.unread}</b>}</span></span>
  </button>;
}
