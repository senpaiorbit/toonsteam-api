// ============================================================
// core/providerManager.js
// Dynamically loads providers and exposes a clean interface.
// Adding a new provider = drop a folder in /providers/ + register in config.
// ============================================================

import config from "./config.js";

// Cache loaded provider modules so we don't re-import on every request
const providerCache = {};

/**
 * Dynamically import and return a provider module.
 * Falls back to the default provider if the requested one is unavailable.
 *
 * @param {string} [name] - Provider name (e.g. "toonstream")
 * @returns {Promise<object>} Provider module
 */
export async function getProvider(name) {
  const providerName = name || config.defaultProvider;

  // Return cached module if already loaded
  if (providerCache[providerName]) {
    return providerCache[providerName];
  }

  try {
    // Dynamic import — works both locally and on Vercel
    const module = await import(`../providers/${providerName}/index.js`);
    providerCache[providerName] = module;
    return module;
  } catch (err) {
    // If requested provider isn't found, warn and fall back to default
    if (providerName !== config.defaultProvider) {
      console.warn(
        `[ProviderManager] Provider "${providerName}" not found. Falling back to "${config.defaultProvider}".`
      );
      return getProvider(config.defaultProvider);
    }

    // Default provider itself is missing — hard error
    throw new Error(
      `[ProviderManager] Default provider "${config.defaultProvider}" could not be loaded: ${err.message}`
    );
  }
}

/**
 * Return the list of all registered providers from config.
 *
 * @returns {string[]}
 */
export function getProviderList() {
  return config.providers;
}
