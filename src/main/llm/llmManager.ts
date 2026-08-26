import { LLMProvider } from './llmProvider'
import { OllamaProvider } from './ollamaProvider'

export class LLMManager {
  private activeProvider: LLMProvider;

  constructor() {
    // Defaults to Ollama with qwen2:1.5b
    this.activeProvider = new OllamaProvider();
  }

  getProvider(): LLMProvider {
    return this.activeProvider;
  }

  async initialize(): Promise<{ status: 'ONLINE' | 'OFFLINE' | 'ERROR'; message: string }> {
    const reachable = await this.activeProvider.isAvailable();
    if (!reachable) {
      return {
        status: 'OFFLINE',
        message: 'Ollama service is unreachable at http://127.0.0.1:11434.',
      };
    }

    const modelName = process.env.OLLAMA_MODEL || 'qwen2:1.5b';
    const hasModel = await this.activeProvider.validateModel(modelName);
    if (!hasModel) {
      return {
        status: 'ERROR',
        message: `Model '${modelName}' was not found in local Ollama instance.`,
      };
    }

    return {
      status: 'ONLINE',
      message: `Connected to Ollama using ${modelName}.`,
    };
  }
}