export class SupabaseRestError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'SupabaseRestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class SupabaseRestClient {
  constructor({ url, serviceRoleKey, fetchImpl = fetch }) {
    this.url = String(url).replace(/\/+$/, '');
    this.key = serviceRoleKey;
    this.fetchImpl = fetchImpl;
  }

  async request(path, { method = 'GET', body, headers = {}, signal } = {}) {
    const response = await this.fetchImpl(`${this.url}/rest/v1/${path.replace(/^\//, '')}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    let payload = null;
    if (response.status !== 204) {
      try { payload = await response.json(); } catch { payload = null; }
    }
    if (!response.ok) throw new SupabaseRestError(payload?.message || `Supabase REST HTTP ${response.status}`, {
      status: response.status, code: payload?.code, details: payload?.details,
    });
    return payload;
  }

  rpc(name, args, options = {}) {
    return this.request(`rpc/${encodeURIComponent(name)}`, { method: 'POST', body: args, ...options });
  }
}
