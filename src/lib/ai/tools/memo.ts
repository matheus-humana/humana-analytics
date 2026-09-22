const cache = new Map<string, { expires: number; promise: Promise<unknown> }>();

/** Share in-flight provider calls across tools in the same turn. */
export function memoTool<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.promise as Promise<T>;
  }

  const promise = load();
  cache.set(key, { expires: Date.now() + ttlMs, promise });
  promise.catch(() => {
    const current = cache.get(key);
    if (current?.promise === promise) cache.delete(key);
  });
  return promise;
}
