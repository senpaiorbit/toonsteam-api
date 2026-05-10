const store = new Map();

// TTL constants (ms)
const TTL = {
  home: 5 * 60 * 1000,
  search: 5 * 60 * 1000,
  series: 30 * 60 * 1000,
  episode: 30 * 60 * 1000,
  stream: 60 * 60 * 1000,
  category: 10 * 60 * 1000,
  movies: 10 * 60 * 1000,
  cast: 10 * 60 * 1000,
  letter: 10 * 60 * 1000,
};

export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function set(key, value, type = "search") {
  const ttl = TTL[type] ?? TTL.search;
  store.set(key, { value, expiresAt: Date.now() + ttl });
}

export function del(key) {
  store.delete(key);
}

export function clear() {
  store.clear();
}

export default { get, set, del, clear };
