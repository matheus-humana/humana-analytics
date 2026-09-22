/** Strip secrets and contact data before text reaches the model or the client. */
export function redactSensitive(text: string): string {
  return text
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/properties\/\d+/g, "properties/[redacted]")
    .slice(0, 400);
}
