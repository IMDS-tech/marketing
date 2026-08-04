import { MetaClient } from './providers/meta/meta-client.js';
import { normalizeMetaSnapshot } from './providers/meta/normalize.js';
import { GoogleAdsClient, normalizeGoogleAdsRows, Ga4Client, normalizeGa4Rows, SearchConsoleClient, normalizeSearchConsoleRows } from './providers/google/index.js';

function context(source) {
  return { agencyId: source.agency_id, clientId: source.client_id, dataSourceId: source.id, externalIdentifier: source.external_identifier, label: source.label };
}

function metaRows(snapshot, source) {
  const normalized = normalizeMetaSnapshot(snapshot, { leadActionTypes: new Set(['lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead','leadgen_grouped']) });
  const dimensionsByAd = new Map(normalized.ads.map(ad => [ad.externalAdId, ad]));
  const adsets = new Map(normalized.adsets.map(item => [item.externalAdsetId, item]));
  const campaigns = new Map(normalized.campaigns.map(item => [item.externalCampaignId, item]));
  const output = [];
  for (const row of normalized.metrics) {
    const ad = dimensionsByAd.get(row.externalAdId);
    const adset = adsets.get(row.externalAdsetId);
    const campaign = campaigns.get(row.externalCampaignId);
    const dimensions = {
      account_id: normalized.account.externalAccountId, account_name: normalized.account.name,
      campaign_id: row.externalCampaignId, campaign_name: campaign?.name || '',
      adset_id: row.externalAdsetId, adset_name: adset?.name || '',
      ad_id: row.externalAdId, ad_name: ad?.name || '', effective_status: ad?.effectiveStatus || null,
      currency: normalized.account.currency,
    };
    const metrics = [['impressions',row.impressions],['clicks',row.clicks],['spend',row.spend],['leads',row.platformLeads],['video_views',row.videoViews]];
    for (const [metric_key,value] of metrics) output.push({ agency_id: source.agency_id, client_id: source.client_id, data_source_id: source.id, integration_slug: 'meta-ads', entity_type: 'ad', entity_id: row.externalAdId, entity_name: ad?.name || row.externalAdId, metric_date: row.reportDate, metric_key, value, dimensions });
  }
  return output;
}

export async function fetchProviderMetrics(source, credential, { dateFrom, dateTo, signal, fetchImpl = fetch } = {}) {
  const slug = source.integration_slug;
  if (slug === 'meta-ads') {
    const client = new MetaClient({ accessToken: credential.access_token, appSecretProof: credential.app_secret_proof || null, graphVersion: credential.graph_version || 'v25.0', fetchImpl });
    const snapshot = await client.getSnapshot(source.external_identifier, { dateFrom, dateTo, signal });
    return metaRows(snapshot, source);
  }
  if (slug === 'google-ads') {
    const client = new GoogleAdsClient({ accessToken: credential.access_token, developerToken: credential.developer_token, loginCustomerId: credential.login_customer_id, apiVersion: credential.api_version || 'v24', fetchImpl });
    return normalizeGoogleAdsRows(await client.fetchCampaignRows(source.external_identifier, { dateFrom, dateTo, signal }), context(source));
  }
  if (slug === 'ga4') {
    const client = new Ga4Client({ accessToken: credential.access_token, fetchImpl });
    return normalizeGa4Rows(await client.fetchCampaignRows(source.external_identifier, { dateFrom, dateTo, signal }), context(source));
  }
  if (slug === 'search-console') {
    const client = new SearchConsoleClient({ accessToken: credential.access_token, fetchImpl });
    return normalizeSearchConsoleRows(await client.fetchSearchRows(source.external_identifier, { dateFrom, dateTo, signal }), context(source));
  }
  throw new Error(`Provider ${slug} is not implemented by this worker`);
}
