import { ChatMessage, LLMOptions, LLMProvider } from './llmProvider'

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(
    baseUrl: string = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: string = process.env.OLLAMA_MODEL || 'qwen2:1.5b'
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async validateModel(modelName: string = this.model): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
      if (!response.ok) return false;
      const data = (await response.json()) as { models: Array<{ name: string }> };
      return data.models.some(
        (m) => m.name === modelName || m.name.startsWith(`${modelName}:`)
      );
    } catch {
      return false;
    }
  }

  async chat(messages: ChatMessage[], options: LLMOptions = {}): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { message: { content: string } };
    return data.message.content;
  }

  async streamChat(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options: LLMOptions = {}
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          options: {
            temperature: options.temperature ?? 0.7,
          },
        }),
        signal: options.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User stopped generation before the request even connected.
        return '';
      }
      throw err;
    }

    if (!response.ok || !response.body) {
      throw new Error(`Ollama streaming failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n').filter((line) => line.trim() !== '');

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
            if (parsed.message?.content) {
              fullResponse += parsed.message.content;
              onChunk(parsed.message.content);
            }
          } catch {
            // Handle partial JSON chunks across buffer boundaries
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Stopped mid-stream — return whatever was generated so far
        // rather than throwing, so the caller can finalize gracefully.
        try {
          await reader.cancel();
        } catch {
          // Reader already closed.
        }
        return fullResponse;
      }
      throw err;
    }

    return fullResponse;
  }
}