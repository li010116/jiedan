// In-memory, per-session snapshot; never stored on disk or shared across users.
export function createSnapshotCache({ ttl = 30000, now = Date.now } = {}) {
  let value, expires = 0, pending, generation = 0;
  const clear = () => { generation++; value = undefined; expires = 0; pending = undefined; };
  function get(loader, { force = false, signal } = {}) {
    if (force) clear();
    let result;
    if (value !== undefined && now() < expires) result = Promise.resolve(value);
    else if (pending) result = pending;
    else {
      const version = generation;
      result = pending = Promise.resolve().then(loader).then(data => {
        if (version === generation) { value = data; expires = now() + ttl; }
        return data;
      }).finally(() => { if (version === generation) pending = undefined; });
    }
    if (!signal) return result;
    if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      result.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }
  return { get, clear };
}

// Bounded, per-session cache: each page and filter has its own entry.
export function createKeyedSnapshotCache({ maxEntries = 40, ...options } = {}) {
  const entries = new Map();
  return {
    get(key, loader, config) {
      let entry = entries.get(key);
      if (!entry) entry = createSnapshotCache(options);
      entries.delete(key);
      entries.set(key, entry);
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        entries.get(oldest).clear();
        entries.delete(oldest);
      }
      return entry.get(loader, config);
    },
    clear() { for (const entry of entries.values()) entry.clear(); entries.clear(); },
  };
}
