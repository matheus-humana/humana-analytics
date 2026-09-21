export function isSyncAuthorized(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret) {
    return true;
  }

  const headerSecret = request.headers.get("x-sync-secret");
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return headerSecret === secret || bearer === secret;
}
