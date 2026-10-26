/** Asks Chrome to keep IndexedDB through disk pressure ("best effort" storage can be evicted). True when kept. */
export async function persistStorage(): Promise<boolean> {
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}
