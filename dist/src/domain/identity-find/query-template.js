export function renderTemplate(value, context) {
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => context[key] ?? "");
}
