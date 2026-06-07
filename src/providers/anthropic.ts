import Anthropic from '@anthropic-ai/sdk';
import type { ILLMAdapter, LLMRequest, LLMResponse } from './adapter';
import type { AnthropicProviderConfig } from '../config/types';

export class AnthropicAdapter implements ILLMAdapter {
  readonly providerName = 'anthropic';
  private readonly client: Anthropic;

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const system = request.messages.find((m) => m.role === 'system')?.content;
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      ...(system ? { system } : {}),
      messages,
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    return {
      content: text,
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? 'end_turn',
    };
  }

  async *completeStream(request: LLMRequest): AsyncGenerator<string> {
    const system = request.messages.find((m) => m.role === 'system')?.content;
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const stream = this.client.messages.stream({
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      ...(system ? { system } : {}),
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }
}
