import { fetchProviderMetrics } from './provider-registry.js';
import { log } from './logger.js';

function failurePayload(error) {
  return { name: error?.name || 'Error', message: error?.message || String(error), status: error?.status ?? null, code: error?.code ?? null, retryable: error?.retryable ?? error?.isTransient ?? null };
}

function retryDelay(job) {
  return Math.min(3600, 60 * (2 ** Math.max(0, Number(job.attempts || 1) - 1)));
}

export class SyncWorker {
  constructor({ repository, credentials, workerId, idleMs = 5000, fetchImpl = fetch }) {
    this.repository = repository;
    this.credentials = credentials;
    this.workerId = workerId;
    this.idleMs = idleMs;
    this.fetchImpl = fetchImpl;
  }

  async runOnce({ signal } = {}) {
    const job = await this.repository.claimJob(this.workerId, { signal });
    if (!job) return false;
    log('info', 'sync job claimed', { jobId: job.id, dataSourceId: job.data_source_id, attempt: job.attempts });
    try {
      const source = await this.repository.getDataSource(job.data_source_id, { signal });
      const credential = await this.credentials.get(source.credential_handle, source.integration_slug, { signal });
      const rows = await fetchProviderMetrics(source, credential, { dateFrom: job.period_from, dateTo: job.period_to, signal, fetchImpl: this.fetchImpl });
      const valid = rows.filter(row => row.metric_date && row.entity_id && Number.isFinite(Number(row.value)));
      const written = await this.repository.upsertMetrics(valid, { signal });
      await this.repository.completeJob(job.id, rows.length, written, { provider: source.integration_slug, dropped_rows: rows.length - valid.length }, { signal });
      log('info', 'sync job completed', { jobId: job.id, fetched: rows.length, written });
      return true;
    } catch (error) {
      const failure = failurePayload(error);
      await this.repository.failJob(job.id, failure, retryDelay(job), { signal });
      log('error', 'sync job failed', { jobId: job.id, ...failure });
      return true;
    }
  }

  async run({ signal } = {}) {
    while (!signal?.aborted) {
      const worked = await this.runOnce({ signal });
      if (!worked) await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, this.idleMs);
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason || new Error('Aborted')); }, { once: true });
      }).catch(error => { if (!signal?.aborted) throw error; });
    }
  }
}
