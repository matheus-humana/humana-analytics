export function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1***@")
    .replace(
      /-----BEGIN[\s\S]+?-----END [A-Z ]+-----/g,
      "[redacted private key]",
    );
}
