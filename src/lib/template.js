export function extractVariables(template) {
  const matches = [...template.matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

export function fillTemplate(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? `{{${name}}}`);
}
