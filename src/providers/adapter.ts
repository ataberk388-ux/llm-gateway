export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  stream: boolean;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: LLMUsage;
  finishReason: string;
}

export interface ILLMAdapter {
  readonly providerName: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
  completeStream(request: LLMRequest): AsyncGenerator<string>;
}
