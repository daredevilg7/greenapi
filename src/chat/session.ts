import { ApiError, GreenApi } from './api';
import type { ChatTransport } from './api';
import { ChatStore } from './store';
import type { Credentials } from './types';
import { createDemoChats } from './demo';
import { pause, runNotificationLoop } from './poller';
import { normalizePhone, validateMessage } from './validation';

export class ChatSession {
  readonly store = new ChatStore();
  private client: ChatTransport | null = null;
  private controller: AbortController | null = null;
  private demo = false;
  constructor(private readonly factory: (credentials: Credentials) => ChatTransport = credentials => new GreenApi(credentials)) {}
  get isDemo() { return this.demo; }

  async connect(credentials: Credentials): Promise<void> {
    this.disconnect();
    const controller = new AbortController();
    this.controller = controller;
    this.store.setConnection('connecting');
    try {
      const client = this.factory(credentials);
      const state = await client.getState(controller.signal);
      if (controller.signal.aborted) return;
      if (state !== 'authorized') {
        throw new Error(state === 'starting' ? 'Инстанс ещё запускается. Подождите немного и подключитесь снова.'
          : 'Сначала авторизуйте MAX-инстанс в кабинете GREEN-API.');
      }
      const settings = await client.getSettings(controller.signal);
      if (controller.signal.aborted) return;
      if (settings.webhookUrl) throw new Error('Очистите webhookUrl в кабинете GREEN-API для получения сообщений через HTTP API.');
      if (settings.incomingWebhook !== 'yes') throw new Error('Включите «Получать уведомления о входящих сообщениях» в настройках инстанса GREEN-API.');
      this.client = client;
      this.store.setConnection('connected');
      void runNotificationLoop(client, {
        onNotification: notification => { if (!controller.signal.aborted) this.store.applyEvent(notification.body); },
        onConnection: (connected, error, fatal) => {
          if (!controller.signal.aborted) this.store.setConnection(connected ? 'connected' : fatal ? 'offline' : 'reconnecting', error);
        },
      }, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      controller.abort();
      this.client = null;
      this.store.setConnection('offline');
      throw error;
    }
  }
  disconnect(): void {
    this.controller?.abort();
    this.controller = null;
    this.client = null;
    this.demo = false;
    this.store.reset();
  }
  async createChat(input: string, name?: string): Promise<string> {
    const phone = normalizePhone(input);
    const controller = this.controller;
    if (!controller) throw new Error('Сначала подключитесь к GREEN-API.');
    const existing = this.store.getSnapshot().chats.find(chat => chat.phone === phone);
    if (existing) { this.store.selectChat(existing.id); return existing.id; }
    let id: string;
    if (this.demo) id = `demo-${phone}`;
    else {
      if (!this.client) throw new Error('Сначала подключитесь к GREEN-API.');
      const account = await this.client.checkAccount(phone, controller.signal);
      if (controller.signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
      if (!account.exist) throw new Error('Аккаунт MAX не найден по этому номеру. Проверьте номер и настройки приватности получателя.');
      id = account.chatId;
    }
    this.store.createChat(id, name?.trim().slice(0, 60) || `+${phone}`, phone);
    this.store.selectChat(id);
    return id;
  }
  async send(chatId: string, text: string): Promise<void> {
    validateMessage(text);
    const controller = this.controller;
    const client = this.client;
    if (!controller || (!this.demo && !client) || !this.store.getSnapshot().chats.some(chat => chat.id === chatId)) {
      throw new Error('Подключитесь к GREEN-API и выберите чат.');
    }
    const id = crypto.randomUUID();
    this.store.addOutgoing(chatId, text, id);
    if (this.demo) {
      await pause(200, controller.signal);
      if (controller.signal.aborted) return;
      this.store.updateMessage(chatId, id, { status: 'sent' });
      void this.demoReply(chatId, id, controller.signal);
      return;
    }
    try {
      const apiId = await client!.send(chatId, text, controller.signal);
      if (!controller.signal.aborted) this.store.updateMessage(chatId, id, { apiId, status: 'sent' });
    } catch (error) {
      if (controller.signal.aborted) return;
      const ambiguous = !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
      this.store.updateMessage(chatId, id, { status: ambiguous ? 'uncertain' : 'failed', error: ambiguous
        ? 'Отправку не удалось подтвердить. Перед повтором проверьте чат в MAX.'
        : error instanceof Error ? error.message : 'Не удалось отправить сообщение.' });
    }
  }
  private async demoReply(chatId: string, id: string, signal: AbortSignal) {
    await pause(300, signal);
    if (signal.aborted) return;
    this.store.updateMessage(chatId, id, { status: 'read' });
    await pause(800, signal);
    if (signal.aborted) return;
    const chat = this.store.getSnapshot().chats.find(item => item.id === chatId);
    if (!chat) return;
    const outgoingCount = chat.messages.filter(message => message.direction === 'outgoing').length;
    const responses = ['Сообщение получил! Всё работает ✨', 'Да, я на связи. Можешь написать ещё 🙂', 'Отлично! До встречи 💜'];
    this.store.applyEvent({ typeWebhook: 'incomingMessageReceived', idMessage: crypto.randomUUID(), timestamp: Date.now() / 1000,
      senderData: { chatId, chatName: chat.name, senderName: chat.name === 'Корпоратив' ? 'Арина Громова' : chat.name },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: responses[outgoingCount % responses.length] } },
    });
  }
  startDemo(activeChatId = 'demo-mikhail'): void {
    this.disconnect();
    this.controller = new AbortController();
    this.demo = true;
    this.store.seed(createDemoChats(), activeChatId);
    this.store.selectChat(activeChatId);
  }
}
