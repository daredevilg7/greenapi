export type Device = 'phone' | 'desktop';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'uncertain';
export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'reconnecting' | 'demo';

export interface Message {
  id: string;
  apiId?: string;
  text: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  status: MessageStatus;
  senderName?: string;
  error?: string;
}

export interface Chat {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
  color: number;
  messages: Message[];
  unread: number;
}

export interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  connection: ConnectionStatus;
  error: string | null;
}

export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl?: string;
}

export interface ApiNotification {
  receiptId: number;
  body: Record<string, unknown>;
}

export interface NotificationTransport {
  receive(signal: AbortSignal): Promise<ApiNotification | null>;
  acknowledge(receiptId: number, signal: AbortSignal): Promise<void>;
}
