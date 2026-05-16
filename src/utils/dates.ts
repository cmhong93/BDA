export function nowIso(): string {
  return new Date().toISOString();
}

export function dateHeaderToIso(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
