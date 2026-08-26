import { create } from 'zustand'
import { AIState, ChatMessageData, SystemMetrics, ViewMode } from '../shared/types'

interface AppState {
  aiState: AIState;
  viewMode: ViewMode;
  systemMetrics: SystemMetrics;
  messages: ChatMessageData[];
  currentConversationId: string | null;
  isGenerating: boolean;

  setAIState: (state: AIState) => void;
  setViewMode: (mode: ViewMode) => void;
  setCurrentConversationId: (id: string | null) => void;
  updateMetrics: (metrics: Partial<SystemMetrics>) => void;
  setMessages: (messages: ChatMessageData[]) => void;
  addMessage: (message: ChatMessageData) => void;
  updateLastMessageContent: (content: string) => void;
  finalizeLastMessage: () => void;
  setIsGenerating: (isGenerating: boolean) => void;
  clearMessages: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  aiState: AIState.ONLINE,
  viewMode: 'HOME',
  systemMetrics: { cpuUsage: 24, cpuTemp: 52, ramUsage: 41 },
  messages: [],
  currentConversationId: null,
  isGenerating: false,

  setAIState: (state) => set({ aiState: state }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  updateMetrics: (metrics) => set((state) => ({ systemMetrics: { ...state.systemMetrics, ...metrics } })),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateLastMessageContent: (content) =>
    set((state) => {
      const updated = [...state.messages];
      if (updated.length > 0) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: updated[updated.length - 1].content + content,
        };
      }
      return { messages: updated };
    }),
  finalizeLastMessage: () =>
    set((state) => {
      const updated = [...state.messages];
      if (updated.length > 0) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          isStreaming: false,
        };
      }
      return { messages: updated };
    }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  clearMessages: () =>
    set({
      messages: [
        {
          id: `init-${Date.now()}`,
          role: 'assistant',
          content: 'Conversation history cleared. Ready for instructions.',
          timestamp: Date.now(),
        },
      ],
    }),
}));