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
function normalizeUrl(value) { return value.replace(/\/+$/, ''); }

export function loadConfig() {
  return Object.freeze({
    supabase: { url: normalizeUrl(required('SUPABASE_URL')), serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY') },
    integrationService: { baseUrl: normalizeUrl(required('INTEGRATION_SERVICE_URL')), token: required('INTEGRATION_SERVICE_TOKEN') },
    worker: {
      id: process.env.WORKER_ID?.trim() || `sync-${process.pid}`,
      idleMs: integer('WORKER_IDLE_MS', 5000, 250, 60000),
      chunkSize: integer('METRIC_UPSERT_CHUNK_SIZE', 500, 1, 2000),
      runOnce: process.env.WORKER_RUN_ONCE === 'true',
    },
  });
}
