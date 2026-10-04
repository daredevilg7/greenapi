import { afterEach, describe, expect, it, vi } from 'vitest';
import { GreenApi } from './api';

const credentials = { idInstance: '310000001', apiTokenInstance: 'test-token-never-real-12345' };
afterEach(() => vi.unstubAllGlobals());

describe('GREEN-API boundary', () => {
  it('sends text using the documented endpoint, without changing its whitespace', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      request = { url, init };
      return new Response(JSON.stringify({ idMessage: 'api-123' }), { status: 200 });
    });
    const result = await new GreenApi(credentials).send('10000000', '  Привет!  ', new AbortController().signal);
    expect(result).toBe('api-123');
    expect(request?.url).toBe('https://3100.api.green-api.com/waInstance310000001/sendMessage/test-token-never-real-12345');
    expect(request?.init.method).toBe('POST');
    expect(JSON.parse(String(request?.init.body))).toEqual({ chatId: '10000000', message: '  Привет!  ' });
  });
  it('returns a canonical MAX identifier from a telephone check', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ exist: true, chatId: '10000000', fromCache: true })));
    expect(await new GreenApi(credentials).checkAccount('79991234567', new AbortController().signal)).toEqual({ exist: true, chatId: '10000000' });
  });
  it('requires a valid response and never displays a raw token-bearing server error', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: `Invalid ${credentials.apiTokenInstance}` }), { status: 401 }));
    const error = await new GreenApi(credentials).send('10000000', 'Привет', new AbortController().signal).catch(error => error);
    expect(error.status).toBe(401);
    expect(error.message).not.toContain(credentials.apiTokenInstance);
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ ok: true })));
    await expect(new GreenApi(credentials).send('10000000', 'Привет', new AbortController().signal)).rejects.toThrow();
  });
  it('does not accept an unsupported notification as a successful empty queue', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ receiptId: 'bad', body: {} })));
    await expect(new GreenApi(credentials).receive(new AbortController().signal)).rejects.toThrow();
  });
});
