import type { ApiNotification, Credentials, NotificationTransport } from './types';
import { normalizePhone, resolveApiUrl, validateMessage } from './validation';

export class ApiError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); }
  get fatal() { return this.status === 401 || this.status === 403; }
}

export interface ChatTransport extends NotificationTransport {
  getState(signal: AbortSignal): Promise<string>;
  getSettings(signal: AbortSignal): Promise<{ incomingWebhook?: string; webhookUrl?: string }>;
  checkAccount(phone: string, signal: AbortSignal): Promise<{ exist: boolean; chatId: string }>;
  send(chatId: string, message: string, signal: AbortSignal): Promise<string>;
}

export class GreenApi implements ChatTransport {
  private readonly base: string;
  private readonly id: string;
  private readonly token: string;
  constructor(credentials: Credentials, private readonly fetcher: typeof fetch = fetch) {
    this.id = credentials.idInstance.trim();
    this.token = credentials.apiTokenInstance.trim();
    if (!/^[\w-]{10,200}$/.test(this.token)) throw new Error('Проверьте apiTokenInstance из кабинета GREEN-API.');
    this.base = resolveApiUrl({ ...credentials, idInstance: this.id });
  }
  private async request(method: string, signal: AbortSignal, body?: unknown, suffix = ''): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.base}/waInstance${this.id}/${method}/${encodeURIComponent(this.token)}${suffix}`, {
        method: method === 'deleteNotification' ? 'DELETE' : body === undefined ? 'GET' : 'POST',
        ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      if (signal.aborted) throw new DOMException('Запрос отменён', 'AbortError');
      throw new ApiError('Не удалось связаться с GREEN-API. Проверьте интернет и apiUrl.');
    }
    if (!response.ok) {
      let hint = '';
      try { hint = (await response.text()).toLowerCase(); } catch { /* Only inspect error categories; never display raw responses. */ }
      const message = response.status === 401 || response.status === 403 ? 'Доступ к инстансу отклонён. Проверьте ключи и состояние аккаунта.'
        : response.status === 429 || response.status === 469 ? 'Достигнут лимит GREEN-API. Подождите и попробуйте ещё раз.'
        : hint.includes('webhook') ? 'Очистите webhookUrl в кабинете GREEN-API, чтобы получать ответы через HTTP API.'
        : response.status === 400 ? 'GREEN-API отклонил запрос. Проверьте данные инстанса и номер получателя.'
        : response.status === 404 ? 'Инстанс не найден. Проверьте idInstance и apiUrl из кабинета.'
        : 'GREEN-API временно недоступен. Попробуйте ещё раз.';
      throw new ApiError(message, response.status);
    }
    try { return await response.json(); } catch { throw new ApiError('GREEN-API вернул некорректный ответ.', 502); }
  }
  async getState(signal: AbortSignal) {
    const result = await this.request('getStateInstance', signal) as { stateInstance?: string };
    if (typeof result?.stateInstance !== 'string') throw new ApiError('Не удалось определить состояние инстанса.', 502);
    return result.stateInstance;
  }
  async getSettings(signal: AbortSignal) {
    const result = await this.request('getSettings', signal);
    if (!result || typeof result !== 'object') throw new ApiError('Не удалось получить настройки инстанса.', 502);
    return result as { incomingWebhook?: string; webhookUrl?: string };
  }
  async checkAccount(phone: string, signal: AbortSignal) {
    const result = await this.request('checkAccount', signal, { phoneNumber: Number(normalizePhone(phone)) }) as { exist?: boolean; chatId?: string; reason?: string };
    if (typeof result?.exist !== 'boolean' || typeof result.chatId !== 'string' || (result.exist && !result.chatId)) {
      if (result?.reason?.includes('limit')) throw new ApiError('MAX ограничил проверку номеров. Попробуйте позже.', 469);
      throw new ApiError('Не удалось проверить номер. Убедитесь, что инстанс авторизован.', 502);
    }
    return { exist: result.exist, chatId: result.chatId };
  }
  async send(chatId: string, message: string, signal: AbortSignal) {
    const result = await this.request('sendMessage', signal, { chatId, message: validateMessage(message) }) as { idMessage?: string };
    if (typeof result?.idMessage !== 'string' || !result.idMessage) throw new ApiError('Не удалось подтвердить отправку сообщения.', 502);
    return result.idMessage;
  }
  async receive(signal: AbortSignal): Promise<ApiNotification | null> {
    const result = await this.request('receiveNotification', signal, undefined, '?receiveTimeout=30');
    if (result === null) return null;
    const notification = result as ApiNotification;
    if (!Number.isSafeInteger(notification?.receiptId) || !notification.body || typeof notification.body !== 'object') {
      throw new ApiError('GREEN-API вернул некорректное уведомление.', 502);
    }
    return notification;
  }
  async acknowledge(receiptId: number, signal: AbortSignal) {
    const result = await this.request('deleteNotification', signal, undefined, `/${receiptId}`) as { result?: boolean };
    if (result?.result !== true) throw new ApiError('Не удалось подтвердить получение уведомления.', 502);
  }
}
