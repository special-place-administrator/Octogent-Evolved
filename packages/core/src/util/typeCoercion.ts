export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  // Reject non-plain objects (Date, RegExp, Map, Set, etc.)
  const proto = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) {
    return null;
  }
  return value as Record<string, unknown>;
};

export const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

export const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    // Reject strings that Number.parseFloat would silently prefix-parse
    // (e.g. "123abc" → 123). Only accept fully numeric strings.
    const trimmed = value.trim();
    if (!/^[-+]?\d*\.?\d+$/.test(trimmed)) {
      return null;
    }
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};
