import type { GatewayConfig } from '../config/types';
import type { ILLMAdapter } from './adapter';
import { AnthropicAdapter } from './anthropic';
import { OpenAIAdapter } from './openai';

export class ProviderFactory {
  static create(config: GatewayConfig): ILLMAdapter {
    const { provider } = config;
    switch (provider.type) {
      case 'anthropic':
        return new AnthropicAdapter(provider.anthropic);
      case 'openai':
        return new OpenAIAdapter(provider.openai, false);
      case 'azure-openai':
        return new OpenAIAdapter(provider.azure, true);
      default: {
        const exhaustive: never = provider;
        throw new Error(`Unknown provider type: ${(exhaustive as { type: string }).type}`);
      }
    }
  }

  static getDefaultModel(config: GatewayConfig): string {
    const { provider } = config;
    switch (provider.type) {
      case 'anthropic':
        return provider.anthropic.defaultModel;
      case 'openai':
        return provider.openai.defaultModel;
      case 'azure-openai':
        return provider.azure.defaultModel;
    }
  }
}
