export interface ChatMessage {
  id: number;
  role: 'bot' | 'user';
  message: string;
  timestamp?: string;
}
