function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
function integer(name, fallback, min, max) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return value;
}
function boolean(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}
function list(name, fallback) { return (process.env[name] ?? fallback).split(',').map(v => v.trim()).filter(Boolean); }
function normalizeUrl(value) { return value.replace(/\/+$/, ''); }

export function loadConfig() {
  const mode = process.env.CREDENTIAL_PROVIDER?.trim() || 'integration-service';
  if (!['integration-service', 'env'].includes(mode)) throw new Error('CREDENTIAL_PROVIDER must be integration-service or env');
  const credentials = mode === 'integration-service'
    ? { mode, baseUrl: normalizeUrl(required('INTEGRATION_SERVICE_URL')), token: required('INTEGRATION_SERVICE_TOKEN') }
    : { mode, accessToken: required('META_ACCESS_TOKEN'), appSecretProof: process.env.META_APP_SECRET_PROOF?.trim() || null };
  return Object.freeze({
    meta: {
      graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || 'v25.0',
      pageSize: integer('META_PAGE_SIZE', 500, 1, 5000),
      maxRetries: integer('META_MAX_RETRIES', 5, 0, 10),
      useAccountAttributionSetting: boolean('META_USE_ACCOUNT_ATTRIBUTION_SETTING', true),
      leadActionTypes: new Set(list('META_LEAD_ACTION_TYPES', 'lead,onsite_conversion.lead_grouped,offsite_conversion.fb_pixel_lead,leadgen_grouped')),
    },
    credentials,
  });
}
