import type { Chat, Message } from './types';

export function createDemoChats(): Chat[] {
  const base = Date.now() - 28 * 60_000;
  const message = (id: string, text: string, minute: number, direction: 'incoming' | 'outgoing', senderName?: string): Message => ({
    id, text, timestamp: base + minute * 60_000, direction, status: 'read', senderName,
  });
  return [
    { id: 'demo-max', name: 'MAX', avatar: 'max', color: 0, unread: 2, messages: [
      message('max-1', '📲 Начать общаться в MAX просто: найдите человека по номеру телефона.', 20, 'incoming'),
    ] },
    { id: 'demo-mikhail', name: 'Михаил Степашкин', phone: '79991234567', avatar: 'ref:mikhail', color: 1, unread: 0, messages: [
      message('m-1', 'Михаил, привет, как дела?:)', 0, 'outgoing'),
    ] },
    { id: 'demo-corporate', name: 'Корпоратив', avatar: 'ref:corporate', color: 3, unread: 2, messages: [
      message('c-history-1', 'Коллеги, давайте выберем день для встречи?', -6, 'incoming', 'Арина Громова'),
      message('c-history-2', 'Я за субботу. У всех получается?', -5, 'outgoing'),
      message('c-history-3', 'У меня суббота свободна 👍', -3, 'incoming', 'Иван Игнатьев'),
      message('c-1', 'Всем привет! Собираемся в эту субботу? 👋', 0, 'outgoing'),
      message('c-2', 'О, куда планируем пойти на корпоратив?', 2, 'incoming', 'Арина Громова'),
      message('c-3', 'Поехали на природу!', 3, 'incoming', 'Иван Игнатьев'),
      message('c-4', 'Отличная идея! Возьму плед и что-нибудь вкусное 🧺', 9, 'outgoing'),
      message('c-5', 'Плюсую! Возьму своих питомцев, пусть побегают', 12, 'incoming', 'Александра'),
      message('c-6', 'Тогда в субботу в 11? ☀️', 15, 'outgoing'),
    ] },
    { id: 'demo-arina', name: 'Арина Громова', phone: '79997654321', avatar: 'ref:arina', color: 2, unread: 1, messages: [
      message('a-1', 'Привет! Отправила тебе всё, о чём договорились.', 12, 'incoming'),
      message('a-2', 'Спасибо! Посмотрю сегодня 💜', 15, 'outgoing'),
      message('a-3', 'Отлично, буду ждать!', 17, 'incoming'),
    ] },
  ];
}
