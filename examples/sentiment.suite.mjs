// Example promptproof suite. Run it offline with:
//   promptproof run examples/sentiment.suite.mjs
//
// It uses the deterministic `mock:sentiment` provider, so it needs no API keys.
export default {
  name: 'sentiment-classifier',
  description: 'Classifies product-review sentiment as JSON. Runs on the offline mock provider.',
  model: 'mock:sentiment',
  prompt:
    'You are a sentiment classifier. Classify the review and respond as JSON ' +
    '{"sentiment": "...", "confidence": n}.\n\nReview: {{review}}',
  cases: [
    {
      name: 'clear positive',
      vars: { review: 'I love this product, it is great and the best I have used.' },
      assert: [
        { type: 'is-json' },
        { type: 'json-path', path: 'sentiment', equals: 'positive' },
        { type: 'max-latency-ms', value: 2000 },
      ],
    },
    {
      name: 'clear negative',
      vars: { review: 'Terrible and buggy. The worst purchase, I want a refund.' },
      assert: [{ type: 'is-json' }, { type: 'json-path', path: 'sentiment', equals: 'negative' }],
    },
    {
      name: 'neutral statement',
      vars: { review: 'It arrived on Tuesday in a cardboard box.' },
      assert: [{ type: 'json-path', path: 'sentiment', equals: 'neutral' }],
    },
    {
      name: 'reports confidence',
      vars: { review: 'Absolutely fantastic, wonderful and the best!' },
      assert: [
        { type: 'json-path', path: 'confidence', exists: true },
        { type: 'contains', value: 'sentiment' },
      ],
    },
    {
      name: 'stays within cost budget',
      vars: { review: 'Good enough for the price.' },
      assert: [{ type: 'max-cost-usd', value: 1 }],
    },
  ],
};
