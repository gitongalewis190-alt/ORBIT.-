// Language help is optional. The compiler does not need it.
// A consumer subscription is not an API key. Nothing here invents one.

export const PROVIDER_ENV = ['ATLAS_AI_PROVIDER', 'XAI_API_KEY', 'ATLAS_MODEL'];

export function providerConfigured(env = {}) {
  return Boolean(env.XAI_API_KEY);
}

export async function extractStructured(env = {}) {
  if (!providerConfigured(env)) return null;
  return null;
}
