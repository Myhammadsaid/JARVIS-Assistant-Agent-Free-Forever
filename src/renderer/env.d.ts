/// <reference types="vite/client" />
export { }

declare global {
interface Window {
  jarvisAPI?: {
    checkLLMStatus: () => Promise<{ status: 'ONLINE' | 'OFFLINE' | 'ERROR'; message: string }>;
    onStreamChunk: (callback: (requestId: string, chunk: string) => void) => () => void;
    getConversations: () => Promise<Array<{ id: string; title: string; created_at: number; updated_at: number }>>;
    createConversation: (id: string, title?: string) => Promise<any>;
    getMessages: (conversationId: string) => Promise<Array<{ id: string; conversation_id: string; role: string; content: string; timestamp: number }>>;
    saveMessage: (msg: { id: string; conversation_id: string; role: string; content: string; timestamp: number }) => Promise<any>;
    deleteConversation: (id: string) => Promise<void>;
    sendPromptStream?: (requestId: string, context: any[]) => Promise<string>;
    abortStream?: (requestId: string) => Promise<boolean>;
      onMetricsUpdate?: (callback: (metrics: { cpuUsage: number; cpuTemp: number; ramUsage: number }) => void) => () => void;
  };
}}