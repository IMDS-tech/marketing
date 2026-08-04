import { createHash } from 'node:crypto';

function text(value, fallback = '') { return value === undefined || value === null ? fallback : String(value); }
function nullableText(value) { const output = text(value).trim(); return output || null; }
function number(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; }
function integer(value) { return Math.round(number(value)); }

export function sumActions(actions, allowedTypes) {
  if (!Array.isArray(actions)) return 0;
  return Math.round(actions.reduce((total, action) => allowedTypes.has(action?.action_type) ? total + number(action?.value) : total, 0));
}
export function sumVideoViews(actions) {
  if (!Array.isArray(actions)) return 0;
  return Math.round(actions.reduce((total, action) => total + number(action?.value), 0));
}
function sourceHash(row) { return createHash('sha256').update(JSON.stringify(row)).digest('hex'); }
function mergeDimension(map, key, value) { if (!value) return; const current = map.get(key); if (!current || current.metadata?.syntheticFromInsights) map.set(key, value); }

export function normalizeMetaSnapshot(snapshot, { leadActionTypes }) {
  const campaigns = new Map(); const adsets = new Map(); const ads = new Map();
  for (const row of snapshot.campaigns ?? []) mergeDimension(campaigns, String(row.id), {
    externalCampaignId: String(row.id), name: text(row.name, `Campaign ${row.id}`), objective: nullableText(row.objective),
    effectiveStatus: nullableText(row.effective_status), startTime: nullableText(row.start_time), stopTime: nullableText(row.stop_time),
    metadata: { providerUpdatedTime: nullableText(row.updated_time) },
  });
  for (const row of snapshot.adsets ?? []) mergeDimension(adsets, String(row.id), {
    externalAdsetId: String(row.id), externalCampaignId: String(row.campaign_id), name: text(row.name, `Ad set ${row.id}`),
    effectiveStatus: nullableText(row.effective_status), optimizationGoal: nullableText(row.optimization_goal), billingEvent: nullableText(row.billing_event),
    metadata: { providerUpdatedTime: nullableText(row.updated_time) },
  });
  for (const row of snapshot.ads ?? []) mergeDimension(ads, String(row.id), {
    externalAdId: String(row.id), externalAdsetId: String(row.adset_id), name: text(row.name, `Ad ${row.id}`),
    creativeId: nullableText(row.creative?.id), effectiveStatus: nullableText(row.effective_status), metadata: { providerUpdatedTime: nullableText(row.updated_time) },
  });
  for (const row of snapshot.insights ?? []) {
    if (row.campaign_id) mergeDimension(campaigns, String(row.campaign_id), { externalCampaignId: String(row.campaign_id), name: text(row.campaign_name, `Campaign ${row.campaign_id}`), objective: null, effectiveStatus: null, startTime: null, stopTime: null, metadata: { syntheticFromInsights: true } });
    if (row.adset_id && row.campaign_id) mergeDimension(adsets, String(row.adset_id), { externalAdsetId: String(row.adset_id), externalCampaignId: String(row.campaign_id), name: text(row.adset_name, `Ad set ${row.adset_id}`), effectiveStatus: null, optimizationGoal: null, billingEvent: null, metadata: { syntheticFromInsights: true } });
    if (row.ad_id && row.adset_id) mergeDimension(ads, String(row.ad_id), { externalAdId: String(row.ad_id), externalAdsetId: String(row.adset_id), name: text(row.ad_name, `Ad ${row.ad_id}`), creativeId: null, effectiveStatus: null, metadata: { syntheticFromInsights: true } });
  }
  const metrics = (snapshot.insights ?? []).map(row => {
    const normalized = { reportDate: text(row.date_start), externalCampaignId: text(row.campaign_id), externalAdsetId: text(row.adset_id), externalAdId: text(row.ad_id), impressions: integer(row.impressions), reach: integer(row.reach), clicks: integer(row.clicks), linkClicks: integer(row.inline_link_clicks), spend: number(row.spend), videoViews: sumVideoViews(row.video_play_actions), platformLeads: sumActions(row.actions, leadActionTypes) };
    return { ...normalized, sourceHash: sourceHash(normalized) };
  });
  return {
    account: { externalAccountId: text(snapshot.account?.id).replace(/^act_/, ''), name: text(snapshot.account?.name, 'Meta ad account'), currency: text(snapshot.account?.currency, 'USD'), timezone: text(snapshot.account?.timezone_name, 'UTC'), status: nullableText(snapshot.account?.account_status), metadata: { provider: 'meta' } },
    campaigns: [...campaigns.values()], adsets: [...adsets.values()], ads: [...ads.values()], metrics,
  };
}
