export class TikTokAdsError extends Error {
  constructor(message,{code=null,requestId=null,retryable=false}={}){super(message);this.name='TikTokAdsError';this.code=code;this.requestId=requestId;this.retryable=retryable;}
}

export class TikTokAdsClient {
  constructor({accessToken,fetchImpl=fetch,baseUrl='https://business-api.tiktok.com/open_api/v1.3'}){this.accessToken=accessToken;this.fetchImpl=fetchImpl;this.baseUrl=baseUrl.replace(/\/+$/,'');}
  async request(path,body,{signal}={}){
    const response=await this.fetchImpl(`${this.baseUrl}${path}`,{method:'POST',headers:{'content-type':'application/json','access-token':this.accessToken},body:JSON.stringify(body),signal});
    const payload=await response.json().catch(()=>null);const code=payload?.code??response.status;
    if(!response.ok||code!==0)throw new TikTokAdsError(payload?.message||`TikTok HTTP ${response.status}`,{code,requestId:payload?.request_id||response.headers.get('x-tt-logid'),retryable:response.status===429||response.status>=500});
    return payload.data||{};
  }
  async fetchCampaignRows(advertiserId,{dateFrom,dateTo,signal,pageSize=1000}={}){
    const rows=[];let page=1;
    while(true){const data=await this.request('/report/integrated/get/',{advertiser_id:String(advertiserId),report_type:'BASIC',data_level:'AUCTION_CAMPAIGN',dimensions:['campaign_id','stat_time_day'],metrics:['campaign_name','spend','impressions','clicks','conversion','total_purchase_value','video_play_actions'],start_date:dateFrom,end_date:dateTo,page,page_size:pageSize},{signal});rows.push(...(data.list||[]));const info=data.page_info||{};if(page>=Number(info.total_page||1)||!(data.list||[]).length)break;page+=1;}return rows;
  }
}

export function normalizeTikTokRows(rows,context){const out=[];for(const row of rows){const d=row.dimensions||{},m=row.metrics||{},entityId=String(d.campaign_id||'unknown'),date=d.stat_time_day||d.date,dimensions={account_id:String(context.externalIdentifier),account_name:context.label||'',campaign_id:entityId,campaign_name:String(m.campaign_name||entityId),effective_status:String(m.campaign_status||'ACTIVE')};for(const [metricKey,value] of [['spend',m.spend],['impressions',m.impressions],['clicks',m.clicks],['conversions',m.conversion],['revenue',m.total_purchase_value],['video_views',m.video_play_actions]]){const number=Number(value||0);out.push({agency_id:context.agencyId,client_id:context.clientId,data_source_id:context.dataSourceId,integration_slug:'tiktok-ads',entity_type:'campaign',entity_id:entityId,entity_name:dimensions.campaign_name,metric_date:date,metric_key:metricKey,value:number,dimensions});}}return out;}
