export class IntegrationCredentialClient {
  constructor({ baseUrl, token, fetchImpl = fetch }) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async get(credentialHandle, provider, { signal } = {}) {
    const url = new URL(`${this.baseUrl}/internal/v1/credentials/${encodeURIComponent(credentialHandle)}`);
    url.searchParams.set('provider', provider);
    const response = await this.fetchImpl(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` }, signal,
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) throw new Error(payload?.message || `Integration Service HTTP ${response.status}`);
    if (!payload || payload.provider !== provider || !payload.access_token) throw new Error('Invalid credential payload');
    return payload;
  }
}
