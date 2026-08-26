export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  signal?: AbortSignal;
}

export interface LLMProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  validateModel(modelName: string): Promise<boolean>;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  streamChat(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: LLMOptions
  ): Promise<string>;
}