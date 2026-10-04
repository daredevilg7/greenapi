import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { expect, it } from 'vitest';
import { GreenApi } from '../src/chat/api';
import { ChatStore } from '../src/chat/store';
import type { ApiNotification } from '../src/chat/types';

const file = '.env.live';
const env = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : process.env;
const mode = process.env.GREEN_API_TEST_MODE || env.GREEN_API_TEST_MODE || 'read';
const report: Record<string, unknown> = { timestamp: new Date().toISOString(), mode, checks: [] };
const checks = report.checks as Record<string, unknown>[];
const save = () => { mkdirSync('.local', { recursive: true }); writeFileSync('.local/api-live-report.json', JSON.stringify(report, null, 2)); };

it('checks the supplied real GREEN-API instance', async () => {
  expect(env.GREEN_API_ID_INSTANCE, 'Заполните .env.live').toBeTruthy();
  expect(env.GREEN_API_TOKEN_INSTANCE, 'Заполните .env.live').toBeTruthy();
  const api = new GreenApi({ idInstance: env.GREEN_API_ID_INSTANCE!, apiTokenInstance: env.GREEN_API_TOKEN_INSTANCE!, apiUrl: env.GREEN_API_URL });
  const controller = new AbortController();
  try {
    const state = await api.getState(controller.signal);
    checks.push({ method: 'getStateInstance', success: true, stateInstance: state });
    const settings = await api.getSettings(controller.signal);
    checks.push({ method: 'getSettings', success: true, incomingWebhook: settings.incomingWebhook, webhookConfigured: !!settings.webhookUrl });
    if (mode === 'read') { report.result = 'connection-checked'; save(); return; }
    expect(state, 'Авторизуйте MAX-инстанс в кабинете GREEN-API').toBe('authorized');
    expect(settings.incomingWebhook, 'Включите входящие уведомления').toBe('yes');
    expect(settings.webhookUrl, 'Очистите webhookUrl для HTTP API').toBeFalsy();
    const markerPath = '.local/api-send-marker.json';
    let chatId: string, marker: string, sentAt: number;
    if (mode === 'receive') {
      expect(existsSync(markerPath), 'Сначала выполните разрешённую тестовую отправку.').toBe(true);
      const saved = JSON.parse(readFileSync(markerPath, 'utf8'));
      expect(saved.chatId && saved.messageId && saved.marker && saved.instance === env.GREEN_API_ID_INSTANCE, 'Маркер не содержит подтверждённую отправку этого инстанса. Проверьте чат MAX.').toBeTruthy();
      chatId = saved.chatId; marker = saved.marker; sentAt = saved.sentAt;
    } else {
      expect(['send', 'roundtrip'], 'Допустимые режимы: read, send, roundtrip, receive').toContain(mode);
      expect(env.GREEN_API_TEST_PHONE, 'Укажите получателя GREEN_API_TEST_PHONE').toBeTruthy();
      const account = await api.checkAccount(env.GREEN_API_TEST_PHONE!, controller.signal);
      expect(account.exist, 'Получатель не найден в MAX').toBe(true);
      checks.push({ method: 'checkAccount', success: true });
      // A completed or ambiguous send is never repeated automatically on the next run.
      expect(existsSync(markerPath), 'Отправка уже запускалась. Для проверки ответа используйте npm run test:api:receive.').toBe(false);
      sentAt = Date.now(); chatId = account.chatId; marker = `MAX-TEST-${sentAt}`;
      writeFileSync(markerPath, JSON.stringify({ startedAt: new Date().toISOString() }));
      const id = await api.send(chatId, `Тест интерфейса MAX (${marker}). Ответьте на это сообщение текстом «Тест пройден».`, controller.signal);
      checks.push({ method: 'sendMessage', success: true, acceptedIntoQueue: true });
      report.messageId = id;
      writeFileSync(markerPath, JSON.stringify({ instance: env.GREEN_API_ID_INSTANCE, chatId, sentAt, messageId: id, marker }));
    }
    report.marker = marker;
    save();
    if (mode === 'send') { report.result = 'sent'; save(); return; }
    // Keep the poller separate from the website so there is only one queue consumer.
    const store = new ChatStore();
    store.createChat(chatId, 'API-тест');
    let answered = false;
    const deadline = Date.now() + 120_000;
    while (!answered && Date.now() < deadline) {
      const event: ApiNotification | null = await api.receive(controller.signal);
      if (!event) continue;
      store.applyEvent(event.body);
      await api.acknowledge(event.receiptId, controller.signal);
      const chat = store.getSnapshot().chats.find(chat => chat.id === chatId);
      answered = !!chat?.messages.some(message => message.direction === 'incoming' && message.text.trim().toLowerCase() === 'тест пройден' && message.timestamp >= sentAt - 1000);
    }
    checks.push({ method: 'receiveNotification + deleteNotification', success: answered });
    expect(answered, 'Ответ «Тест пройден» ещё не получен. Сообщение повторно не отправлено.').toBe(true);
    report.result = 'roundtrip-passed';
  } catch (error) {
    report.result = 'failed';
    report.error = error instanceof Error ? error.message : 'Ошибка проверки';
    throw error;
  } finally { controller.abort(); save(); }
});
