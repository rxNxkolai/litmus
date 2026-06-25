import type { Provider, ProviderName } from '../types.js';
import { mockProvider } from './mock.js';
import { openaiProvider } from './openai.js';
import { anthropicProvider } from './anthropic.js';

/** Resolve a provider by name. */
export function getProvider(name: ProviderName): Provider {
  switch (name) {
    case 'mock':
      return mockProvider;
    case 'openai':
      return openaiProvider;
    case 'anthropic':
      return anthropicProvider;
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

/** Sensible default model for each provider. */
export function defaultModel(name: ProviderName): string {
  switch (name) {
    case 'mock':
      return 'mock:echo';
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-haiku';
    default:
      return 'mock:echo';
  }
}

export { mockProvider, openaiProvider, anthropicProvider };
