import { describe, expect, it } from 'vitest';
import { ChatStore } from './store';

function textEvent(id = 'api-in-1', text = 'Привет!', chatId = '10000000') {
  return {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: 310000001, wid: '79991234567@c.us', typeInstance: 'v3' },
    timestamp: 1763115112,
    idMessage: id,
    senderData: { chatId, chatName: 'Михаил', chatType: 'user', sender: chatId, senderName: 'Михаил', senderPhoneNumber: 79991234567 },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  };
}

describe('shared chat state', () => {
  it('deduplicates a repeated incoming notification', () => {
    const store = new ChatStore();
    store.applyEvent(textEvent());
    store.applyEvent(textEvent());
    const chat = store.getSnapshot().chats[0];
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0].text).toBe('Привет!');
    expect(chat.unread).toBe(1);
  });
  it('does not count the open conversation as unread', () => {
    const store = new ChatStore();
    store.createChat('10000000', 'Михаил');
    store.selectChat('10000000');
    store.applyEvent(textEvent());
    expect(store.getSnapshot().chats[0].unread).toBe(0);
  });
  it('keeps an outgoing API echo in the same optimistic bubble', () => {
    const store = new ChatStore();
    store.createChat('10000000', 'Михаил');
    store.addOutgoing('10000000', 'Привет!', 'local-1');
    const event = { ...textEvent('api-out-1'), typeWebhook: 'outgoingAPIMessageReceived', timestamp: Math.floor(Date.now() / 1000) };
    store.applyEvent(event);
    store.updateMessage('10000000', 'local-1', { apiId: 'api-out-1', status: 'sent' });
    expect(store.getSnapshot().chats[0].messages).toHaveLength(1);
    expect(store.getSnapshot().chats[0].messages[0].apiId).toBe('api-out-1');
  });
  it('updates delivery status without downgrading a read message', () => {
    const store = new ChatStore();
    store.createChat('10000000', 'Михаил');
    store.addOutgoing('10000000', 'Привет!', 'local-1');
    store.updateMessage('10000000', 'local-1', { apiId: 'api-out-1', status: 'sent' });
    store.applyEvent({ typeWebhook: 'outgoingMessageStatus', chatId: '10000000', idMessage: 'api-out-1', status: 'read' });
    store.applyEvent({ typeWebhook: 'outgoingMessageStatus', chatId: '10000000', idMessage: 'api-out-1', status: 'delivered' });
    expect(store.getSnapshot().chats[0].messages[0].status).toBe('read');
  });
  it('receives extended text and safely skips non-text or malformed events', () => {
    const store = new ChatStore();
    store.applyEvent({ ...textEvent(), messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'Текст со ссылкой' } } });
    store.applyEvent({ ...textEvent('media'), messageData: { typeMessage: 'imageMessage' } });
    store.applyEvent({ typeWebhook: 'incomingMessageReceived', senderData: null });
    expect(store.getSnapshot().chats[0].messages.map(m => m.text)).toEqual(['Текст со ссылкой']);
  });
  it('keeps snapshot identity until a real mutation and notifies subscribers', () => {
    const store = new ChatStore();
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);
    let changed = 0;
    const unsubscribe = store.subscribe(() => changed++);
    store.createChat('10000000', 'Михаил');
    expect(store.getSnapshot()).not.toBe(first);
    expect(changed).toBe(1);
    unsubscribe();
    store.createChat('20000000', 'Анна');
    expect(changed).toBe(1);
  });
  it('binds a retry echo to the new attempt, leaving the rejected attempt failed', () => {
    const store = new ChatStore();
    store.createChat('10000000', 'Михаил');
    store.addOutgoing('10000000', 'Привет!', 'attempt-a');
    store.updateMessage('10000000', 'attempt-a', { status: 'failed' });
    store.addOutgoing('10000000', 'Привет!', 'attempt-b');
    store.applyEvent({ ...textEvent('api-b'), typeWebhook: 'outgoingAPIMessageReceived', timestamp: Date.now() / 1000 });
    store.updateMessage('10000000', 'attempt-b', { apiId: 'api-b', status: 'sent' });
    const messages = store.getSnapshot().chats[0].messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].status).toBe('failed');
    expect(messages[0].apiId).toBeUndefined();
    expect(messages[1].apiId).toBe('api-b');
  });
  it('reconciles an ambiguous same-text echo using the authoritative send response', () => {
    const store = new ChatStore();
    store.createChat('10000000', 'Михаил');
    store.addOutgoing('10000000', 'Привет!', 'attempt-a');
    store.updateMessage('10000000', 'attempt-a', { status: 'uncertain' });
    store.addOutgoing('10000000', 'Привет!', 'attempt-b');
    store.applyEvent({ ...textEvent('api-b'), typeWebhook: 'outgoingAPIMessageReceived', timestamp: Date.now() / 1000 });
    store.updateMessage('10000000', 'attempt-b', { apiId: 'api-b', status: 'sent' });
    const messages = store.getSnapshot().chats[0].messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].status).toBe('uncertain');
    expect(messages[0].apiId).toBeUndefined();
    expect(messages[1].apiId).toBe('api-b');
  });
  it('preserves a delivery failure received before the HTTP enqueue confirmation', () => {
    const store = new ChatStore();
    store.createChat('10000000', 'Михаил');
    store.addOutgoing('10000000', 'Привет!', 'local-1');
    store.applyEvent({ ...textEvent('api-out-1'), typeWebhook: 'outgoingAPIMessageReceived', timestamp: Date.now() / 1000 });
    store.applyEvent({ typeWebhook: 'outgoingMessageStatus', chatId: '10000000', idMessage: 'api-out-1', status: 'failed' });
    store.updateMessage('10000000', 'local-1', { apiId: 'api-out-1', status: 'sent' });
    expect(store.getSnapshot().chats[0].messages[0].status).toBe('failed');
    store.applyEvent({ typeWebhook: 'outgoingMessageStatus', chatId: '10000000', idMessage: 'api-out-1', status: 'delivered' });
    expect(store.getSnapshot().chats[0].messages[0].status).toBe('delivered');
  });
});
