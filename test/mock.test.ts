import { describe, it, expect } from 'vitest';
import { mockProvider } from '../src/providers/mock.js';

describe('mock provider', () => {
  it('is deterministic and classifies positive sentiment', async () => {
    const a = await mockProvider.generate({
      prompt: 'I love this, it is great!',
      model: 'mock:sentiment',
    });
    const b = await mockProvider.generate({
      prompt: 'I love this, it is great!',
      model: 'mock:sentiment',
    });
    expect(a.text).toBe(b.text);
    expect(JSON.parse(a.text).sentiment).toBe('positive');
  });

  it('classifies negative sentiment', async () => {
    const r = await mockProvider.generate({
      prompt: 'terrible, broken, the worst',
      model: 'mock:sentiment',
    });
    expect(JSON.parse(r.text).sentiment).toBe('negative');
  });

  it('classifies neutral sentiment', async () => {
    const r = await mockProvider.generate({
      prompt: 'a box arrived on Tuesday',
      model: 'mock:sentiment',
    });
    expect(JSON.parse(r.text).sentiment).toBe('neutral');
  });

  it('echo returns the trimmed prompt and reports tokens', async () => {
    const r = await mockProvider.generate({ prompt: '  hello world  ', model: 'mock:echo' });
    expect(r.text).toBe('hello world');
    expect(r.completionTokens).toBeGreaterThan(0);
  });
});
