export function renderTemplate(value: string, context: Record<string, string>): string {
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => context[key] ?? "");
}
