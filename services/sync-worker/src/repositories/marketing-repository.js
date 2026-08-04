const METRIC_CONFLICT = 'agency_id,client_id,data_source_id,integration_slug,entity_type,entity_id,metric_date,metric_key';
const BREAKDOWN_CONFLICT = 'agency_id,client_id,data_source_id,integration_slug,entity_type,entity_id,breakdown_type,breakdown_value,metric_date,metric_key,attribution_setting';

function eq(value) { return encodeURIComponent(String(value)); }

export class MarketingRepository {
  constructor(client, { chunkSize = 500 } = {}) {
    this.client = client;
    this.chunkSize = chunkSize;
  }

  async claimJob(workerId, { signal } = {}) {
    const rows = await this.client.rpc('claim_marketing_sync_job', { worker_id: workerId }, { signal });
    return Array.isArray(rows) ? rows[0] || null : null;
  }

  enqueueResync(targetDate = null, { signal } = {}) {
    return this.client.rpc('enqueue_marketing_resync_jobs', { target_date: targetDate }, { signal });
  }

  async getDataSource(id, { signal } = {}) {
    const rows = await this.client.request(`data_sources?select=id,agency_id,client_id,integration_id,account_id,label,external_identifier,settings,status&id=eq.${eq(id)}&limit=1`, { signal });
    const source = rows?.[0];
    if (!source) throw new Error(`Data source ${id} not found`);
    const integrations = await this.client.request(`integrations?select=slug&id=eq.${eq(source.integration_id)}&limit=1`, { signal });
    const integration = integrations?.[0];
    if (!integration) throw new Error(`Integration ${source.integration_id} not found`);
    let account = null;
    if (source.account_id) {
      const accounts = await this.client.request(`data_source_accounts?select=credential_handle,external_account_id,metadata&id=eq.${eq(source.account_id)}&limit=1`, { signal });
      account = accounts?.[0] || null;
    }
    if (!account?.credential_handle) throw new Error(`Credential handle missing for data source ${id}`);
    return { ...source, integration_slug: integration.slug, credential_handle: account.credential_handle, account_metadata: account.metadata || {}, account_external_id: account.external_account_id };
  }

  upsertMetrics(rows, options = {}) {
    return this.#upsertRows('marketing_daily_metrics', METRIC_CONFLICT, rows, options);
  }

  upsertBreakdowns(rows, options = {}) {
    return this.#upsertRows('marketing_breakdown_daily', BREAKDOWN_CONFLICT, rows, options);
  }

  async #upsertRows(table, conflict, rows, { signal } = {}) {
    let written = 0;
    for (let offset = 0; offset < rows.length; offset += this.chunkSize) {
      const chunk = rows.slice(offset, offset + this.chunkSize);
      await this.client.request(`${table}?on_conflict=${encodeURIComponent(conflict)}`, {
        method: 'POST', body: chunk, signal,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
      written += chunk.length;
    }
    return written;
  }

  completeJob(jobId, fetchedRows, writtenRows, metadata, { signal } = {}) {
    return this.client.rpc('complete_marketing_sync_job', {
      job_id: jobId, fetched_rows: fetchedRows, written_rows: writtenRows, run_metadata: metadata || {},
    }, { signal });
  }

  failJob(jobId, failure, retryDelaySeconds, { signal } = {}) {
    return this.client.rpc('fail_marketing_sync_job', {
      job_id: jobId, failure, retry_delay_seconds: retryDelaySeconds,
    }, { signal });
  }
}
