import { loadConfig } from './config.js';
import { MetaClient } from './providers/meta/meta-client.js';
import { normalizeMetaSnapshot } from './providers/meta/normalize.js';

async function resolveCredential(config, signal) {
  if (config.credentials.mode === 'env') {
    return { accessToken: config.credentials.accessToken, appSecretProof: config.credentials.appSecretProof };
  }

  const integrationId = process.env.INTEGRATION_ID?.trim();
  if (!integrationId) throw new Error('Missing required environment variable: INTEGRATION_ID');
  const url = new URL(`${config.credentials.baseUrl}/internal/v1/integrations/${encodeURIComponent(integrationId)}/credentials`);
  url.searchParams.set('provider', 'meta');
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${config.credentials.token}` },
    signal,
  });
  if (!response.ok) throw new Error(`Integration Service returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.provider !== 'meta' || !payload?.access_token) throw new Error('Invalid Meta credential payload');
  return { accessToken: payload.access_token, appSecretProof: payload.app_secret_proof || null };
}

const controller = new AbortController();
for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => controller.abort());

try {
  const config = loadConfig();
  const accountId = process.env.META_AD_ACCOUNT_ID?.trim();
  const dateFrom = process.env.DATE_FROM?.trim();
  const dateTo = process.env.DATE_TO?.trim();
  if (!accountId || !dateFrom || !dateTo) throw new Error('META_AD_ACCOUNT_ID, DATE_FROM and DATE_TO are required');

  const credential = await resolveCredential(config, controller.signal);
  const client = new MetaClient({
    ...credential,
    graphVersion: config.meta.graphVersion,
    pageSize: config.meta.pageSize,
    maxRetries: config.meta.maxRetries,
    useAccountAttributionSetting: config.meta.useAccountAttributionSetting,
  });
  const providerSnapshot = await client.getSnapshot(accountId, { dateFrom, dateTo, signal: controller.signal });
  const snapshot = normalizeMetaSnapshot(providerSnapshot, { leadActionTypes: config.meta.leadActionTypes });

  process.stdout.write(`${JSON.stringify(snapshot)}\n`);
} catch (error) {
  console.error(JSON.stringify({ level: 'error', message: error.message, status: error.status ?? null, code: error.code ?? null }));
  process.exitCode = 1;
}
