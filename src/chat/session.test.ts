import { describe, expect, it } from 'vitest';
import { ChatSession } from './session';
import type { ChatTransport } from './api';
import { ApiError } from './api';

const credentials = { idInstance: '310000001', apiTokenInstance: 'test-token-not-real-12345' };

function transport(overrides: Partial<ChatTransport> = {}): ChatTransport {
  return {
    getState: async () => 'authorized',
    getSettings: async () => ({ incomingWebhook: 'yes', webhookUrl: '' }),
    checkAccount: async () => ({ exist: true, chatId: '10000000' }),
    send: async () => 'api-1',
    receive: signal => new Promise(resolve => { signal.addEventListener('abort', () => resolve(null), { once: true }); }),
    acknowledge: async () => {},
    ...overrides,
  };
}

describe('session isolation and sending', () => {
  it('creates a real chat with the canonical ID, preserving the entered phone', async () => {
    const session = new ChatSession(() => transport());
    await session.connect(credentials);
    const id = await session.createChat('+7 (999) 123-45-67', 'Михаил');
    expect(id).toBe('10000000');
    expect(session.store.getSnapshot().chats[0].phone).toBe('79991234567');
    session.disconnect();
  });
  it('keeps a sending failure visible and never retries it automatically', async () => {
    let sends = 0;
    const session = new ChatSession(() => transport({ send: async () => { sends++; throw new ApiError('Сеть недоступна'); } }));
    await session.connect(credentials);
    await session.createChat('79991234567');
    await session.send('10000000', 'Привет!');
    const message = session.store.getSnapshot().chats[0].messages[0];
    expect(message.status).toBe('uncertain');
    expect(message.text).toBe('Привет!');
    expect(sends).toBe(1);
    session.disconnect();
  });
  it('ignores a send response that arrives after switching sessions', async () => {
    let complete!: (id: string) => void;
    const session = new ChatSession(() => transport({ send: () => new Promise(resolve => { complete = resolve; }) }));
    await session.connect(credentials);
    await session.createChat('79991234567');
    const pending = session.send('10000000', 'Привет!');
    session.disconnect();
    session.startDemo();
    const before = session.store.getSnapshot();
    complete('late-api-message');
    await pending;
    expect(session.store.getSnapshot()).toBe(before);
    session.disconnect();
  });
  it('rejects a non-authorized instance with a useful explanation', async () => {
    const session = new ChatSession(() => transport({ getState: async () => 'notAuthorized' }));
    await expect(session.connect(credentials)).rejects.toThrow(/авториз/);
    expect(session.store.getSnapshot().connection).toBe('offline');
  });
  it('explains incompatible webhook settings without changing the user account', async () => {
    const session = new ChatSession(() => transport({ getSettings: async () => ({ incomingWebhook: 'yes', webhookUrl: 'https://existing.example/webhook' }) }));
    await expect(session.connect(credentials)).rejects.toThrow(/webhookUrl/);
    expect(session.store.getSnapshot().chats).toEqual([]);
  });
});
