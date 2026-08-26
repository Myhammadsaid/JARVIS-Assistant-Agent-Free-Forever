import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('jarvisAPI', {
  checkLLMStatus: () => ipcRenderer.invoke('llm:check-status'),
  sendPromptStream: (requestId: string, messages: any[]) =>
    ipcRenderer.invoke('llm:generate-stream', requestId, messages),
  abortStream: (requestId: string) => ipcRenderer.invoke('llm:abort-stream', requestId),
  onStreamChunk: (callback: (requestId: string, chunk: string) => void) => {
    const subscription = (_event: any, requestId: string, chunk: string) =>
      callback(requestId, chunk);
    ipcRenderer.on('llm:stream-chunk', subscription);
    return () => ipcRenderer.removeListener('llm:stream-chunk', subscription);
  },
  // DB Persistence
  getConversations: () => ipcRenderer.invoke('db:get-conversations'),
  createConversation: (id: string, title?: string) => ipcRenderer.invoke('db:create-conversation', id, title),
  getMessages: (conversationId: string) => ipcRenderer.invoke('db:get-messages', conversationId),
  saveMessage: (msg: any) => ipcRenderer.invoke('db:save-message', msg),
  deleteConversation: (id: string) => ipcRenderer.invoke('db:delete-conversation', id),

  onMetricsUpdate: (callback: (metrics: { cpuUsage: number; cpuTemp: number; ramUsage: number }) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('system-metrics-update', subscription);
    return () => ipcRenderer.removeListener('system-metrics-update', subscription);
  },
},
);