import type { ApiNotification, NotificationTransport } from './types';
import { ApiError } from './api';

export interface PollCallbacks {
  onNotification(notification: ApiNotification): void;
  onConnection(connected: boolean, error?: string, fatal?: boolean): void;
}
export function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener('abort', finish, { once: true });
  });
}

export async function runNotificationLoop(client: NotificationTransport, callbacks: PollCallbacks, signal: AbortSignal): Promise<void> {
  let pending: ApiNotification | null = null;
  let processed = false;
  let delay = 1000;
  while (!signal.aborted) {
    try {
      if (!pending) {
        pending = await client.receive(signal);
        if (signal.aborted) return;
        processed = false;
      }
      if (pending) {
        if (!processed) { callbacks.onNotification(pending); processed = true; }
        if (signal.aborted) return;
        await client.acknowledge(pending.receiptId, signal);
        pending = null;
      } else {
        await pause(250, signal);
      }
      if (signal.aborted) return;
      callbacks.onConnection(true);
      delay = 1000;
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof ApiError ? error.message : 'Соединение прервано. Восстанавливаем получение сообщений…';
      callbacks.onConnection(false, message, error instanceof ApiError && error.fatal);
      if (error instanceof ApiError && error.fatal) return;
      await pause(delay, signal);
      delay = Math.min(delay * 2, 15_000);
    }
  }
}
