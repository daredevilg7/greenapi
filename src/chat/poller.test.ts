import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { runNotificationLoop } from './poller';
import type { NotificationTransport } from './types';

const notification = { receiptId: 7, body: { typeWebhook: 'incomingMessageReceived' } };
afterEach(() => vi.useRealTimers());

describe('notification queue lifecycle', () => {
  it('processes a notification before acknowledging it and exits on abort', async () => {
    const controller = new AbortController();
    const steps: string[] = [];
    const client: NotificationTransport = {
      receive: async () => { steps.push('receive'); return notification; },
      acknowledge: async (receiptId) => { steps.push(`ack:${receiptId}`); controller.abort(); },
    };
    await runNotificationLoop(client, { onNotification: () => steps.push('process'), onConnection: () => {} }, controller.signal);
    expect(steps).toEqual(['receive', 'process', 'ack:7']);
  });
  it('retries the same receipt without processing the event twice', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const steps: string[] = [];
    let attempt = 0;
    const client: NotificationTransport = {
      receive: async () => { steps.push('receive'); return notification; },
      acknowledge: async (id) => {
        steps.push(`ack:${id}`);
        if (attempt++ === 0) throw new ApiError('Сеть недоступна');
        controller.abort();
      },
    };
    const loop = runNotificationLoop(client, { onNotification: () => steps.push('process'), onConnection: () => {} }, controller.signal);
    await vi.advanceTimersByTimeAsync(1000);
    await loop;
    expect(steps).toEqual(['receive', 'process', 'ack:7', 'ack:7']);
  });
  it('stops on an authorization error without silently retrying forever', async () => {
    const errors: string[] = [];
    const client: NotificationTransport = {
      receive: async () => { throw new ApiError('Проверьте ключи GREEN-API.', 401); },
      acknowledge: async () => {},
    };
    await runNotificationLoop(client, { onNotification: () => {}, onConnection: (_, error) => { if (error) errors.push(error); } }, new AbortController().signal);
    expect(errors).toEqual(['Проверьте ключи GREEN-API.']);
  });
  it('does not process a late response after logout', async () => {
    const controller = new AbortController();
    const events: unknown[] = [];
    const client: NotificationTransport = {
      receive: async () => { controller.abort(); return notification; },
      acknowledge: async () => { events.push('ack'); },
    };
    await runNotificationLoop(client, { onNotification: n => events.push(n), onConnection: () => {} }, controller.signal);
    expect(events).toEqual([]);
  });
});
