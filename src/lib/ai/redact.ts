/** Strip secrets and contact data before text reaches a model, webhook, or the client. */
export function redactSensitive(text: string, maxLength = 400): string {
  const redacted = text
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/properties\/\d+/g, "properties/[redacted]");

  if (!Number.isFinite(maxLength) || maxLength < 0) return redacted;
  return redacted.slice(0, maxLength);
}
