const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function integer(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function boolean(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be "true" or "false"`);
}

function list(name, fallback) {
  const raw = process.env[name];
  return (raw ?? fallback).split(',').map(value => value.trim()).filter(Boolean);
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, '');
}

export function loadConfig() {
  for (const name of REQUIRED) required(name);

  const credentialProvider = process.env.CREDENTIAL_PROVIDER?.trim() || 'integration-service';
  if (!['integration-service', 'env'].includes(credentialProvider)) {
    throw new Error('CREDENTIAL_PROVIDER must be "integration-service" or "env"');
  }

  if (credentialProvider === 'integration-service') {
    required('INTEGRATION_SERVICE_URL');
    required('INTEGRATION_SERVICE_TOKEN');
  } else {
    required('META_ACCESS_TOKEN');
  }

  return Object.freeze({
    supabase: {
      url: normalizeUrl(required('SUPABASE_URL')),
      serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    },
    worker: {
      id: process.env.WORKER_ID?.trim() || `marketing-${process.pid}`,
      pollIntervalMs: integer('POLL_INTERVAL_MS', 10_000, { min: 500, max: 300_000 }),
      runOnce: boolean('RUN_ONCE', false),
      platform: process.env.JOB_PLATFORM?.trim() || 'meta',
    },
    meta: {
      graphVersion: process.env.META_GRAPH_API_VERSION?.trim() || 'v25.0',
      pageSize: integer('META_PAGE_SIZE', 500, { min: 1, max: 5000 }),
      maxRetries: integer('META_MAX_RETRIES', 5, { min: 0, max: 10 }),
      useAccountAttributionSetting: boolean('META_USE_ACCOUNT_ATTRIBUTION_SETTING', true),
      leadActionTypes: new Set(list(
        'META_LEAD_ACTION_TYPES',
        'lead,onsite_conversion.lead_grouped,offsite_conversion.fb_pixel_lead,leadgen_grouped',
      )),
    },
    credentials: credentialProvider === 'integration-service'
      ? {
          mode: credentialProvider,
          baseUrl: normalizeUrl(required('INTEGRATION_SERVICE_URL')),
          token: required('INTEGRATION_SERVICE_TOKEN'),
        }
      : {
          mode: credentialProvider,
          accessToken: required('META_ACCESS_TOKEN'),
          appSecretProof: process.env.META_APP_SECRET_PROOF?.trim() || null,
        },
  });
}
