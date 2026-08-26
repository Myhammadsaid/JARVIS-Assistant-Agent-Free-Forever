export enum AIState {
  OFFLINE = 'OFFLINE',
  CONNECTING = 'CONNECTING',
  ONLINE = 'ONLINE',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR'
}

export interface SystemMetrics {
  cpuUsage: number;
  cpuTemp: number | null;
  ramUsage: number;
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export type ViewMode = 'HOME' | 'CHAT';