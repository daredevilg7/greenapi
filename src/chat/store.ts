import type { Chat, ChatState, ConnectionStatus, Message, MessageStatus } from './types';

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function mergeStatus(current: MessageStatus, next: MessageStatus): MessageStatus {
  const rank = { sending: 0, uncertain: 1, failed: 1, sent: 2, delivered: 3, read: 4 };
  if (current === 'failed' && next !== 'delivered' && next !== 'read') return current;
  if (next === 'failed' && rank[current] < 3) return next;
  return rank[next] >= rank[current] ? next : current;
}

export class ChatStore {
  private state: ChatState = { chats: [], activeChatId: null, connection: 'offline', error: null };
  private listeners = new Set<() => void>();
  private earlyStatuses = new Map<string, MessageStatus>();

  getSnapshot = (): ChatState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private set(next: ChatState) {
    this.state = next;
    this.listeners.forEach(listener => listener());
  }
  setConnection(connection: ConnectionStatus, error: string | null = null) {
    this.set({ ...this.state, connection, error });
  }
  reset() {
    this.earlyStatuses.clear();
    this.set({ chats: [], activeChatId: null, connection: 'offline', error: null });
  }
  seed(chats: Chat[], activeChatId: string) {
    this.earlyStatuses.clear();
    this.set({ chats, activeChatId, connection: 'demo', error: null });
  }
  createChat(id: string, name: string, phone?: string) {
    if (this.state.chats.some(chat => chat.id === id)) return;
    const color = [...id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 5;
    this.set({ ...this.state, chats: [{ id, name, phone, color, unread: 0, messages: [] }, ...this.state.chats] });
  }
  selectChat(id: string | null) {
    this.set({ ...this.state, activeChatId: id, chats: this.state.chats.map(chat => chat.id === id ? { ...chat, unread: 0 } : chat) });
  }
  addOutgoing(chatId: string, text: string, id: string) {
    const message: Message = { id, text, timestamp: Date.now(), direction: 'outgoing', status: 'sending' };
    this.set({ ...this.state, chats: this.state.chats.map(chat => chat.id === chatId ? { ...chat, messages: [...chat.messages, message] } : chat) });
  }
  updateMessage(chatId: string, id: string, updates: Partial<Message>) {
    this.set({ ...this.state, chats: this.state.chats.map(chat => {
      if (chat.id !== chatId) return chat;
      const echo = updates.apiId ? chat.messages.find(message => message.apiId === updates.apiId && message.id !== id) : undefined;
      return { ...chat, messages: chat.messages.filter(message => !echo || message.id !== echo.id).map(message => {
        if (message.id !== id) return message;
        const early = updates.apiId ? this.earlyStatuses.get(updates.apiId) : undefined;
        if (updates.apiId) this.earlyStatuses.delete(updates.apiId);
        let status = mergeStatus(message.status, early ?? updates.status ?? message.status);
        if (echo) status = mergeStatus(status, echo.status);
        return { ...message, ...updates, status, error: ['failed', 'uncertain'].includes(status) ? updates.error ?? message.error : undefined };
      }),
    }; }) });
  }
  applyEvent(event: Record<string, unknown>) {
    if (event.typeWebhook === 'outgoingMessageStatus') {
      const status = event.status;
      if (typeof event.idMessage !== 'string' || !['sent', 'delivered', 'read', 'failed'].includes(String(status))) return;
      let found = false;
      const chats = this.state.chats.map(chat => ({ ...chat, messages: chat.messages.map(message => {
        if (message.apiId !== event.idMessage) return message;
        found = true;
        return { ...message, status: mergeStatus(message.status, status as MessageStatus) };
      }) }));
      if (found) this.set({ ...this.state, chats });
      else {
        const previous = this.earlyStatuses.get(event.idMessage);
        this.earlyStatuses.set(event.idMessage, previous ? mergeStatus(previous, status as MessageStatus) : status as MessageStatus);
        if (this.earlyStatuses.size > 500) this.earlyStatuses.delete(this.earlyStatuses.keys().next().value!);
      }
      return;
    }
    const incoming = event.typeWebhook === 'incomingMessageReceived';
    if (!incoming && !['outgoingMessageReceived', 'outgoingAPIMessageReceived'].includes(String(event.typeWebhook))) return;
    const sender = record(event.senderData);
    const data = record(event.messageData);
    const chatId = sender.chatId;
    const id = event.idMessage;
    const text = data.typeMessage === 'textMessage' ? record(data.textMessageData).textMessage
      : data.typeMessage === 'extendedTextMessage' ? record(data.extendedTextMessageData).text : undefined;
    if (typeof chatId !== 'string' || typeof id !== 'string' || typeof text !== 'string') return;
    const timestamp = typeof event.timestamp === 'number' ? event.timestamp * 1000 : Date.now();
    const name = String(sender.chatName || sender.senderContactName || sender.senderName || chatId);
    if (!this.state.chats.some(chat => chat.id === chatId)) {
      this.createChat(chatId, name, sender.senderPhoneNumber ? String(sender.senderPhoneNumber) : undefined);
    }
    const chat = this.state.chats.find(item => item.id === chatId)!;
    if (chat.messages.some(message => message.apiId === id || message.id === id)) return;
    if (!incoming && event.typeWebhook === 'outgoingAPIMessageReceived') {
      const candidates = chat.messages.filter(message => message.direction === 'outgoing' && !message.apiId
        && ['sending', 'uncertain'].includes(message.status) && message.text === text && Math.abs(message.timestamp - timestamp) < 120_000);
      // An identical retry can make text-based matching ambiguous. Its HTTP response
      // provides the authoritative ID; updateMessage then collapses the temporary echo.
      if (candidates.length === 1) { this.updateMessage(chatId, candidates[0].id, { apiId: id, status: 'sent' }); return; }
    }
    const early = this.earlyStatuses.get(id);
    this.earlyStatuses.delete(id);
    const message: Message = { id, apiId: id, text, timestamp, direction: incoming ? 'incoming' : 'outgoing',
      status: incoming ? 'read' : early ?? 'sent', senderName: typeof sender.senderName === 'string' ? sender.senderName : undefined };
    this.set({ ...this.state, chats: this.state.chats.map(item => item.id === chatId ? { ...item,
      unread: item.unread + (incoming && this.state.activeChatId !== chatId ? 1 : 0),
      messages: [...item.messages, message].sort((a, b) => a.timestamp - b.timestamp),
    } : item) });
  }
}
