import test from 'node:test';
import assert from 'node:assert/strict';
import {TikTokAdsClient} from '../src/providers/tiktok/tiktok-ads-client.js';
import {MarketingRepository} from '../src/repositories/marketing-repository.js';

test('TikTok Ads client paginates and normalizes campaign metrics',async()=>{
  const calls=[];
  const fetchImpl=async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return {ok:true,json:async()=>({code:0,request_id:'req-1',data:{list:[{dimensions:{stat_time_day:'2026-08-04',campaign_id:'c1'},metrics:{campaign_name:'Campaign 1',spend:'12.5',impressions:'1000',clicks:'42',conversion:'3',video_play_actions:'500'}}],page_info:{page:1,total_page:1}}})}};
  const client=new TikTokAdsClient({accessToken:'token',fetchImpl});
  const raw=await client.fetchCampaignRows('adv-1',{dateFrom:'2026-08-01',dateTo:'2026-08-04'});
  const rows=client.normalize(raw,{agencyId:'a',clientId:'c',dataSourceId:'d',externalIdentifier:'adv-1'});
  assert.equal(calls.length,1);
  assert.equal(rows.find(row=>row.metric_key==='spend').value,12.5);
  assert.equal(rows.find(row=>row.metric_key==='video_views').value,500);
  assert.equal(rows.every(row=>row.integration_slug==='tiktok-ads'),true);
});

test('rolling resync scheduler calls service-role RPC with target date',async()=>{
  const calls=[];
  const repository=new MarketingRepository({rpc:async(name,payload)=>{calls.push({name,payload});return 4}});
  const inserted=await repository.enqueueResync('2026-08-04');
  assert.equal(inserted,4);
  assert.deepEqual(calls,[{name:'enqueue_marketing_resync_jobs',payload:{target_date:'2026-08-04'}}]);
});
