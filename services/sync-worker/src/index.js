import { loadConfig } from './config.js';
import { SupabaseRestClient } from './repositories/supabase-rest-client.js';
import { MarketingRepository } from './repositories/marketing-repository.js';
import { IntegrationCredentialClient } from './repositories/integration-credentials.js';
import { SyncWorker } from './worker.js';
import { log } from './logger.js';

const controller = new AbortController();
for (const name of ['SIGINT', 'SIGTERM']) process.on(name, () => controller.abort(new Error(name)));

try {
  const config = loadConfig();
  const rest = new SupabaseRestClient({ url: config.supabase.url, serviceRoleKey: config.supabase.serviceRoleKey });
  const repository = new MarketingRepository(rest, { chunkSize: config.worker.chunkSize });
  if (config.worker.enqueueResync) {
    const inserted = await repository.enqueueResync(config.worker.resyncDate, { signal: controller.signal });
    log('info', 'rolling resync jobs enqueued', { inserted, targetDate: config.worker.resyncDate || 'current_date' });
  } else {
    const credentials = new IntegrationCredentialClient(config.integrationService);
    const worker = new SyncWorker({ repository, credentials, workerId: config.worker.id, idleMs: config.worker.idleMs });
    log('info', 'sync worker started', { workerId: config.worker.id, runOnce: config.worker.runOnce });
    if (config.worker.runOnce) await worker.runOnce({ signal: controller.signal });
    else await worker.run({ signal: controller.signal });
  }
} catch (error) {
  if (!controller.signal.aborted) {
    log('error', 'sync worker terminated', { name: error.name, message: error.message, status: error.status ?? null, code: error.code ?? null });
    process.exitCode = 1;
  }
}
