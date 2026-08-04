export const BREAKDOWN_TYPES = Object.freeze([
  'age',
  'gender',
  'country',
  'region',
  'device',
  'operating_system',
  'publisher_platform',
  'placement',
]);

export const ENTITY_LEVELS = Object.freeze(['account', 'campaign', 'adgroup', 'ad']);

const BASE_METRICS = Object.freeze(['spend', 'clicks', 'impressions', 'conversions']);

const CAPABILITIES = Object.freeze({
  'meta-ads': Object.freeze({
    age: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'insights'),
    gender: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'insights'),
    country: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'insights'),
    region: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'insights', { availability: 'limited' }),
    device: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'insights', { availability: 'limited' }),
    operating_system: capability([], [], 'insights', { availability: 'unsupported' }),
    publisher_platform: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'insights'),
    placement: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'insights', { availability: 'limited' }),
  }),
  'tiktok-ads': Object.freeze({
    age: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'audience', { availability: 'limited' }),
    gender: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'audience', { availability: 'limited' }),
    country: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'audience', { availability: 'limited' }),
    region: capability([], [], 'audience', { availability: 'unsupported' }),
    device: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'audience', { availability: 'limited' }),
    operating_system: capability(['account', 'campaign', 'adgroup', 'ad'], BASE_METRICS, 'audience', { availability: 'limited' }),
    publisher_platform: capability([], [], 'audience', { availability: 'unsupported' }),
    placement: capability([], [], 'audience', { availability: 'unsupported' }),
  }),
  'google-ads': Object.freeze({
    age: capability(['campaign', 'adgroup'], BASE_METRICS, 'audience', { availability: 'limited' }),
    gender: capability(['campaign', 'adgroup'], BASE_METRICS, 'audience', { availability: 'limited' }),
    country: capability(['campaign'], BASE_METRICS, 'audience', { availability: 'limited' }),
    region: capability(['campaign'], BASE_METRICS, 'audience', { availability: 'limited' }),
    device: capability(['campaign', 'adgroup', 'ad'], BASE_METRICS, 'basic'),
    operating_system: capability([], [], 'basic', { availability: 'unsupported' }),
    publisher_platform: capability([], [], 'basic', { availability: 'unsupported' }),
    placement: capability([], [], 'basic', { availability: 'unsupported' }),
  }),
});

function capability(levels, metrics, reportFamily, options = {}) {
  return Object.freeze({
    levels: Object.freeze([...levels]),
    metrics: Object.freeze([...metrics]),
    reportFamily,
    supportsDailyTimeDimension: true,
    availability: options.availability || 'available',
    maxDateRangeDays: options.maxDateRangeDays || null,
  });
}

export function getBreakdownCapability(integration, breakdown) {
  if (!BREAKDOWN_TYPES.includes(breakdown)) {
    throw new Error(`Unsupported canonical breakdown: ${breakdown}`);
  }
  const provider = CAPABILITIES[integration];
  if (!provider) {
    return capability([], [], 'insights', { availability: 'unsupported' });
  }
  return provider[breakdown];
}

export function assertBreakdownRequest({ integration, breakdown, level, metrics }) {
  if (!ENTITY_LEVELS.includes(level)) {
    throw new Error(`Unsupported entity level: ${level}`);
  }
  const capability = getBreakdownCapability(integration, breakdown);
  if (capability.availability === 'unsupported') {
    throw new Error(`${integration} does not support ${breakdown}`);
  }
  if (!capability.levels.includes(level)) {
    throw new Error(`${integration} does not support ${breakdown} at ${level} level`);
  }
  const unsupportedMetrics = metrics.filter(metric => !capability.metrics.includes(metric));
  if (unsupportedMetrics.length) {
    throw new Error(`Unsupported ${integration} ${breakdown} metrics: ${unsupportedMetrics.join(', ')}`);
  }
  return capability;
}

const VALUE_ALIASES = Object.freeze({
  gender: Object.freeze({
    female: 'female', f: 'female', woman: 'female', women: 'female',
    male: 'male', m: 'male', man: 'male', men: 'male',
    none: 'unknown', unknown: 'unknown', unspecified: 'unknown', null: 'unknown',
  }),
  operating_system: Object.freeze({
    android: 'android',
    iphone: 'ios_iphone', ios_iphone: 'ios_iphone',
    ipad: 'ios_ipad', ios_ipad: 'ios_ipad',
    ios: 'ios',
    windows: 'windows', macos: 'macos', linux: 'linux',
    unknown: 'unknown', none: 'unknown', unspecified: 'unknown',
  }),
});

export function normalizeBreakdownValue(type, rawValue) {
  if (!BREAKDOWN_TYPES.includes(type)) throw new Error(`Unsupported canonical breakdown: ${type}`);
  const raw = String(rawValue ?? 'unknown').trim();
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (type === 'age') return normalizeAge(key);
  if (type === 'country') return raw.toUpperCase();
  return VALUE_ALIASES[type]?.[key] || key || 'unknown';
}

function normalizeAge(value) {
  const normalized = value
    .replace(/^age_/, '')
    .replace(/\+/g, '_plus')
    .replace(/-/g, '_');
  if (/^\d{2}_\d{2}$/.test(normalized)) return normalized;
  if (/^\d{2}_plus$/.test(normalized)) return normalized;
  if (['none', 'unknown', 'unspecified'].includes(normalized)) return 'unknown';
  return normalized || 'unknown';
}

export function deriveBreakdownMetrics(input) {
  const spend = number(input.spend);
  const clicks = number(input.clicks);
  const impressions = number(input.impressions);
  const conversions = number(input.conversions);
  const revenue = number(input.revenue);
  return {
    ...input,
    spend,
    clicks,
    impressions,
    conversions,
    revenue,
    cpc: divide(spend, clicks),
    cpm: divide(spend * 1000, impressions),
    ctr: divide(clicks, impressions),
    conversion_rate: divide(conversions, clicks),
    cost_per_conversion: divide(spend, conversions),
    roas: divide(revenue, spend),
  };
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function divide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}
