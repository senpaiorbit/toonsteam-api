import toonstream from "../providers/toonsteam/index.js";

const providers = {
  toonstream,
};

const PROVIDER_NAME = process.env.PROVIDER || "toonstream";

export function getProvider(name = PROVIDER_NAME) {
  const p = providers[name];
  if (!p) throw new Error(`Unknown provider: "${name}"`);
  return p;
}

export function getProviderName() {
  return PROVIDER_NAME;
}

export default { getProvider, getProviderName };
