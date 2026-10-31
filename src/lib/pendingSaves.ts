/** Lets sign-out wait for open editors to persist their unsaved changes first. */
const flushers = new Set<() => Promise<boolean>>();

export function registerFlusher(flush: () => Promise<boolean>): () => void {
  flushers.add(flush);
  return () => void flushers.delete(flush);
}

/** Resolves to false if any pending change could not be saved. */
export async function flushPendingSaves(): Promise<boolean> {
  const results = await Promise.all([...flushers].map((flush) => flush()));
  return results.every(Boolean);
}
