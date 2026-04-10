/**
 * Accepts ISO 8601, Excel/CSV-style dates, and date-only YYYY-MM-DD.
 * Invalid strings throw so Zod can surface errors.
 */
export function parseFlexibleDateTime(input: string): string {
  const s = input.trim();
  if (!s) throw new Error("Empty date");
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const t = Date.parse(normalized);
  if (Number.isNaN(t)) throw new Error(`Unrecognized date: ${input}`);
  return new Date(t).toISOString();
}

export function parseOptionalDateTime(
  input: string | null | undefined,
): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || (typeof input === "string" && input.trim() === "")) {
    return null;
  }
  return parseFlexibleDateTime(String(input));
}
