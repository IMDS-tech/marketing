import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../src/pages/integrations/PaidAdsCampaignsPage.tsx',import.meta.url),'utf8');
const api=await readFile(new URL('../src/advertising-api.ts',import.meta.url),'utf8');
const router=await readFile(new URL('../src/main.tsx',import.meta.url),'utf8');
const navigation=await readFile(new URL('../src/modules/navigation.ts',import.meta.url),'utf8');

test('advertising pages use authenticated Report API without demo data',()=>{
  assert.match(api,/VITE_REPORT_API_URL/);
  assert.match(api,/Bearer/);
  assert.match(page,/advertisingApi\.workspace/);
  assert.doesNotMatch(page,/META_CAMPAIGNS|TIKTOK_CAMPAIGNS|demoRows|getSupabaseBrowserClient/);
});

test('campaign and funnel routes are live for all supported ad platforms',()=>{
  for(const route of ['/ads/campaigns','/meta-ads/campaigns','/tiktok-ads/campaigns','/google-ads/campaigns','/ads/funnel'])assert.ok(router.includes(route),route);
  assert.match(navigation,/funnel-analytics/);
  assert.match(navigation,/ads\/campaigns/);
});

test('campaign UI includes filters, comparison, export, pagination and funnel',()=>{
  for(const token of ['currencySelectionRequired','exportCsv','CampaignTable','FunnelCard','previous','pages'])assert.ok(page.includes(token),token);
});
