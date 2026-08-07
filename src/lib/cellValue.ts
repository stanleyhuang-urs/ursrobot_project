export function parseNumberInput(text: string): number | null {
  if (text.trim() === "") return null;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeTextInput(text: string): string | null {
  return text === "" ? null : text;
}
