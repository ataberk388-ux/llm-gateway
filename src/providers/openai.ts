import OpenAI, { AzureOpenAI } from 'openai';
import type { ILLMAdapter, LLMRequest, LLMResponse } from './adapter';
import type {
  OpenAIProviderConfig,
  AzureOpenAIProviderConfig,
} from '../config/types';

export class OpenAIAdapter implements ILLMAdapter {
  readonly providerName: string;
  private readonly client: OpenAI;

  constructor(
    config: OpenAIProviderConfig | AzureOpenAIProviderConfig,
    isAzure: boolean
  ) {
    if (isAzure) {
      const c = config as AzureOpenAIProviderConfig;
      this.providerName = 'azure-openai';
      this.client = new AzureOpenAI({
        apiKey: c.apiKey,
        endpoint: c.endpoint,
        apiVersion: c.apiVersion,
        deployment: c.deployment,
      });
    } else {
      const c = config as OpenAIProviderConfig;
      this.providerName = 'openai';
      this.client = new OpenAI({ apiKey: c.apiKey });
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: false,
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content ?? '',
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? 'stop',
    };
  }

  async *completeStream(request: LLMRequest): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
