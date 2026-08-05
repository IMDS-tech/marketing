import { fetchProviderMetrics } from './provider-registry.js';
import { validateMetricRows,assertQualityThreshold } from './data-quality.js';
import { failurePayload,retryDelaySeconds } from './retry-policy.js';
import { log } from './logger.js';

export class SyncWorker {
  constructor({ repository, credentials, workerId, idleMs = 5000, fetchImpl = fetch, minimumAcceptanceRate = 0.8 }) {
    if (!workerId?.trim()) throw new Error('workerId is required');
    this.repository = repository;
    this.credentials = credentials;
    this.workerId = workerId;
    this.idleMs = idleMs;
    this.fetchImpl = fetchImpl;
    this.minimumAcceptanceRate = minimumAcceptanceRate;
  }

  async runOnce({ signal } = {}) {
    const job = await this.repository.claimJob(this.workerId, { signal });
    if (!job) return false;
    const startedAt=Date.now();
    log('info', 'sync job claimed', { jobId: job.id, dataSourceId: job.data_source_id, attempt: job.attempts, workerId: this.workerId });
    try {
      const source = await this.repository.getDataSource(job.data_source_id, { signal });
      const credential = await this.credentials.get(source.credential_handle, source.integration_slug, { signal });
      const rows = await fetchProviderMetrics(source, credential, { dateFrom: job.period_from, dateTo: job.period_to, signal, fetchImpl: this.fetchImpl });
      const quality=assertQualityThreshold(validateMetricRows(rows,source),{minimumAcceptanceRate:this.minimumAcceptanceRate});
      const written = await this.repository.upsertMetrics(quality.accepted, { signal });
      const metadata={provider:source.integration_slug,duration_ms:Date.now()-startedAt,data_quality:{received:quality.received,accepted:quality.acceptedCount,rejected:quality.rejectedCount,duplicates:quality.duplicates,reasons:quality.reasons,acceptance_rate:quality.acceptanceRate}};
      await this.repository.completeJob(job.id, this.workerId, rows.length, written, metadata, { signal });
      log('info', 'sync job completed', { jobId: job.id, fetched: rows.length, written, rejected:quality.rejectedCount, durationMs:metadata.duration_ms, workerId: this.workerId });
      return true;
    } catch (error) {
      const failure = failurePayload(error,job);
      const delay=retryDelaySeconds(job,error);
      await this.repository.failJob(job.id, this.workerId, failure, delay, { signal });
      log('error', 'sync job failed', { jobId: job.id, workerId: this.workerId, retryDelaySeconds:delay, durationMs:Date.now()-startedAt, ...failure });
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
