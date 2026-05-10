import config from "./config.js";
import toonstream from "../providers/toonstream/index.js";

const providers = {
  toonstream,
};

export function getProvider(name = config.provider) {
  const p = providers[name];
  if (!p) throw new Error(`Unknown provider: "${name}"`);
  return p;
}

export function getProviderName() {
  return config.provider;
}

export default { getProvider, getProviderName };
