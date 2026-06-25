// A deliberately mixed suite (some pass, some fail) used to show how the
// HTML report renders failures. Not run in CI gating.
export default {
  name: 'regression-demo',
  description: 'Intentionally contains failing cases to demonstrate the report.',
  model: 'mock:sentiment',
  prompt: 'Classify the sentiment of this review as JSON: {{review}}',
  cases: [
    {
      name: 'correctly positive',
      vars: { review: 'I love it, it is great and the best!' },
      assert: [{ type: 'json-path', path: 'sentiment', equals: 'positive' }],
    },
    {
      name: 'mislabeled on purpose',
      description: 'Expects "positive" for an obviously negative review, so it fails.',
      vars: { review: 'This is terrible, broken, and the worst.' },
      assert: [{ type: 'json-path', path: 'sentiment', equals: 'positive' }],
    },
    {
      name: 'expects an apology',
      description: 'The classifier never emits an apology, so this fails.',
      vars: { review: 'It is fine.' },
      assert: [{ type: 'contains', value: 'apology' }],
    },
  ],
};
