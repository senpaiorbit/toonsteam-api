// ============================================================
// utils/cache.js
// Simple in-memory key-value cache with TTL support.
// No external dependencies — just a Map + timestamps.
// ============================================================

import config from "../core/config.js";

/** Internal store: key → { value, expiresAt } */
const store = new Map();

/**
 * Get a cached value. Returns null if missing or expired.
 *
 * @param {string} key
 * @returns {any|null}
 */
export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;

  // Evict if expired
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Store a value in the cache with a TTL.
 *
 * @param {string} key
 * @param {any} value
 * @param {number} [ttl] - Seconds until expiry. Defaults to config value.
 */
export function cacheSet(key, value, ttl) {
  const ttlMs = (ttl ?? config.cache.ttl) * 1000;

  // Evict oldest entry if cache is full
  if (store.size >= config.cache.maxSize) {
    const oldestKey = store.keys().next().value;
    store.delete(oldestKey);
  }

  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Remove a specific key from the cache.
 *
 * @param {string} key
 */
export function cacheDel(key) {
  store.delete(key);
}

/**
 * Clear all cache entries.
 */
export function cacheClear() {
  store.clear();
}

/**
 * Return current cache size (for debugging / health checks).
 *
 * @returns {number}
 */
export function cacheSize() {
  return store.size;
}
