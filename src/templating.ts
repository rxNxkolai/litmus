import type { Vars } from './types.js';

/**
 * Render a prompt template, replacing `{{ var }}` placeholders with values from
 * `vars`. Unknown placeholders render as an empty string.
 */
export function render(template: string, vars: Vars): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined ? '' : String(value);
  });
}
