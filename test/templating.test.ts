import { describe, it, expect } from 'vitest';
import { render } from '../src/templating.js';

describe('render', () => {
  it('substitutes variables', () => {
    expect(render('Hi {{name}}', { name: 'Bo' })).toBe('Hi Bo');
  });
  it('blanks unknown variables', () => {
    expect(render('A {{x}} B', {})).toBe('A  B');
  });
  it('repeats and coerces values', () => {
    expect(render('{{a}}-{{a}}', { a: 'z' })).toBe('z-z');
    expect(render('n={{n}}', { n: 5 })).toBe('n=5');
  });
  it('tolerates whitespace inside braces', () => {
    expect(render('{{  name  }}', { name: 'x' })).toBe('x');
  });
});
