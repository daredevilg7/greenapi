// @vitest-environment node
import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GreenApi } from '../src/chat/api';
import { ChatSession } from '../src/chat/session';
import { runNotificationLoop } from '../src/chat/poller';

const credentials = { idInstance: '310000001', apiTokenInstance: 'dummy-http-test-token-0000' };
const event = { receiptId: 23, body: { typeWebhook: 'incomingMessageReceived', idMessage: 'received-1', timestamp: 1780000000, senderData: { chatId: 'MAX-CANONICAL-ID', senderName: 'Получатель' }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Ответ из MAX' } } } };
let origin = '';
let state = 'authorized';
let status = 200;
let brokenJson = false;
let pending = false;
let queue: typeof event | null = null;
let ackFailures = 0;
const requests: { method: string; path: string; query: string; body: unknown }[] = [];
let pendingResponse: ServerResponse | undefined;

const server = createServer(async (req, res) => {
  let text = '';
  for await (const chunk of req) text += chunk;
  const url = new URL(req.url!, 'http://localhost');
  const method = url.pathname.split('/')[2];
  requests.push({ method: req.method!, path: method, query: url.search, body: text ? JSON.parse(text) : null });
  res.setHeader('Content-Type', 'application/json');
  if (status !== 200) { res.writeHead(status); res.end(JSON.stringify({ error: credentials.apiTokenInstance })); return; }
  if (brokenJson) { res.end('broken JSON'); return; }
  let body: unknown;
  switch (method) {
    case 'getStateInstance': body = { stateInstance: state }; break;
    case 'getSettings': body = { incomingWebhook: 'yes', webhookUrl: '', outgoingWebhook: 'yes' }; break;
    case 'checkAccount': body = { exist: true, chatId: 'MAX-CANONICAL-ID' }; break;
    case 'sendMessage': body = { idMessage: 'sent-1' }; break;
    case 'receiveNotification':
      if (pending) { pendingResponse = res; return; }
      body = queue; break;
    case 'deleteNotification':
      if (ackFailures-- > 0) { res.writeHead(500); res.end('{}'); return; }
      expect(url.pathname.endsWith('/23')).toBe(true);
      queue = null; body = { result: true }; break;
    default: res.writeHead(404); body = {};
  }
  res.end(JSON.stringify(body));
});

// Production keeps the official-domain restriction. Only this test adapter redirects
// requests to our local HTTP server; real fetch, headers, JSON and abort remain intact.
const adapter: typeof fetch = (input, init) => {
  const url = new URL(String(input));
  return fetch(`${origin}${url.pathname}${url.search}`, init);
};
const client = () => new GreenApi(credentials, adapter);

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});
beforeEach(() => { requests.length = 0; state = 'authorized'; status = 200; brokenJson = false; pending = false; queue = null; ackFailures = 0; pendingResponse = undefined; });

describe('GREEN-API over a real HTTP connection', () => {
  it('checks state and settings, then resolves the phone to the canonical MAX chat', async () => {
    const session = new ChatSession(() => client());
    await session.connect(credentials);
    const id = await session.createChat('+7 (999) 123-45-67', 'Получатель');
    expect(id).toBe('MAX-CANONICAL-ID');
    expect(session.store.getSnapshot().connection).toBe('connected');
    expect(requests.find(r => r.path === 'checkAccount')).toMatchObject({ method: 'POST', body: { phoneNumber: 79991234567 } });
    session.disconnect();
  });
  it('sends UTF-8 text, receives a notification and acknowledges the exact receipt', async () => {
    const api = client(), signal = new AbortController().signal;
    expect(await api.send('MAX-CANONICAL-ID', '  Привет! 👋\nНовая строка  ', signal)).toBe('sent-1');
    queue = event;
    expect(await api.receive(signal)).toEqual(event);
    await api.acknowledge(23, signal);
    expect(requests).toEqual([
      { method: 'POST', path: 'sendMessage', query: '', body: { chatId: 'MAX-CANONICAL-ID', message: '  Привет! 👋\nНовая строка  ' } },
      { method: 'GET', path: 'receiveNotification', query: '?receiveTimeout=30', body: null },
      { method: 'DELETE', path: 'deleteNotification', query: '', body: null },
    ]);
    expect(await api.receive(signal)).toBeNull();
  });
  it('blocks sending for an unauthorised instance before consuming its queue', async () => {
    state = 'notAuthorized';
    const session = new ChatSession(() => client());
    await expect(session.connect(credentials)).rejects.toThrow('авторизуйте');
    expect(requests.map(r => r.path)).toEqual(['getStateInstance']);
    expect(session.store.getSnapshot().connection).toBe('offline');
    session.disconnect();
  });
  it('sanitizes an actual HTTP 401 response', async () => {
    status = 401;
    const error = await client().getState(new AbortController().signal).catch(e => e);
    expect(error.status).toBe(401);
    expect(error.fatal).toBe(true);
    expect(error.message).not.toContain(credentials.apiTokenInstance);
  });
  it('cancels a pending HTTP long poll', async () => {
    pending = true;
    const controller = new AbortController();
    const result = client().receive(controller.signal).catch(e => e);
    await vi.waitFor(() => expect(pendingResponse).toBeDefined());
    controller.abort();
    expect((await result).name).toBe('AbortError');
    pendingResponse?.destroy();
  });
  it('rejects malformed JSON returned by a successful HTTP response', async () => {
    brokenJson = true;
    await expect(client().getState(new AbortController().signal)).rejects.toMatchObject({ status: 502 });
  });
  it('retries a failed receipt deletion without applying the message twice', async () => {
    queue = event; ackFailures = 1;
    const controller = new AbortController(), apply = vi.fn();
    const loop = runNotificationLoop(client(), { onNotification: apply, onConnection: () => {} }, controller.signal);
    await vi.waitFor(() => expect(requests.filter(r => r.path === 'deleteNotification')).toHaveLength(2), { timeout: 4000 });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(event);
    controller.abort(); await loop;
  });
});
