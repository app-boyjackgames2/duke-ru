/**
 * In-tab serialising lock for the Supabase auth client.
 *
 * The default implementation uses the Web Locks API with `steal: true`, which
 * makes concurrent tabs abort each other's refresh with
 * "Lock broken by another request with the 'steal' option" and triggers a
 * refresh storm. Serialising inside the tab is enough: cross-tab consistency is
 * handled by the storage event / onAuthStateChange.
 */
const queues = new Map<string, Promise<unknown>>();

export function memoryLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const previous = queues.get(name) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  queues.set(
    name,
    run.catch(() => undefined),
  );
  return run;
}
