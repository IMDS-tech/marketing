import {BadRequestException,Controller,ForbiddenException,Get,Headers,Query} from '@nestjs/common';
import {z} from 'zod';
import {Db} from './db.js';
import {AccessService,verifyUserJwt} from './security.js';

const uuid=z.string().uuid();
const date=z.string().date();
const inputSchema=z.object({
  agencyId:uuid,
  clientId:uuid,
  dateFrom:date,
  dateTo:date,
  platform:z.enum(['all','meta-ads','tiktok-ads','google-ads']).default('all'),
  accountId:z.string().trim().max(160).optional(),
  status:z.string().trim().max(80).optional(),
  currency:z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  search:z.string().trim().max(160).default(''),
  sortBy:z.enum(['campaignName','accountName','status','impressions','clicks','spend','leads','targetLeads','arrived','sales','revenue','ctr','cpc','cpm','cpl','cpa','roas']).default('spend'),
  sortDir:z.enum(['asc','desc']).default('desc'),
  page:z.coerce.number().int().min(1).max(100000).default(1),
  pageSize:z.coerce.number().int().min(1).max(100).default(25),
});

type Input=z.infer<typeof inputSchema>;
type MetricRow={period:string;metric_key:string;value:string|number};
type OptionRow={integration_slug:string;account_id:string;account_name:string;effective_status:string;currency:string};
type CampaignDbRow={integration_slug:string;account_id:string;account_name:string;campaign_id:string;campaign_name:string;effective_status:string;currency:string;impressions:string|number;clicks:string|number;spend:string|number;leads:string|number;target_leads:string|number;arrived:string|number;sales:string|number;revenue:string|number};
type TrendDbRow={metric_date:string;impressions:string|number;clicks:string|number;spend:string|number;leads:string|number;target_leads:string|number;arrived:string|number;sales:string|number;revenue:string|number};

const metricKeys=['impressions','clicks','spend','leads','crm_leads','target_leads','appointments','arrived','sales','conversions','revenue'] as const;
const numeric=(value:unknown)=>{const result=Number(value??0);return Number.isFinite(result)?result:0};
const divide=(left:number,right:number)=>right>0?left/right:0;
const parse=<T>(schema:z.ZodType<T>,value:unknown):T=>{const result=schema.safeParse(value);if(!result.success)throw new BadRequestException(result.error.flatten());return result.data};
const iso=(value:Date)=>value.toISOString().slice(0,10);
function range(input:Input){
  const from=new Date(`${input.dateFrom}T00:00:00.000Z`),to=new Date(`${input.dateTo}T00:00:00.000Z`);
  if(to<from)throw new BadRequestException('DATE_RANGE_INVALID');
  const days=Math.floor((to.getTime()-from.getTime())/86400000)+1;
  if(days>1095)throw new BadRequestException('DATE_RANGE_TOO_LARGE');
  const previousTo=new Date(from);previousTo.setUTCDate(previousTo.getUTCDate()-1);
  const previousFrom=new Date(previousTo);previousFrom.setUTCDate(previousFrom.getUTCDate()-days+1);
  return{dateFrom:input.dateFrom,dateTo:input.dateTo,previousFrom:iso(previousFrom),previousTo:iso(previousTo),days};
}
function totals(rows:MetricRow[],period:string){
  const raw:Record<string,number>={};for(const row of rows)if(row.period===period)raw[row.metric_key]=numeric(row.value);
  const impressions=raw.impressions||0,clicks=raw.clicks||0,spend=raw.spend||0,leads=raw.leads||0,targetLeads=raw.target_leads||0,arrived=raw.arrived||raw.appointments||0,sales=raw.sales||raw.conversions||0,revenue=raw.revenue||0;
  return{impressions,clicks,spend,leads,crmLeads:raw.crm_leads||0,targetLeads,arrived,sales,revenue,ctr:divide(clicks,impressions),cpc:divide(spend,clicks),cpm:divide(spend,impressions)*1000,cpl:divide(spend,leads),cpa:divide(spend,sales),roas:divide(revenue,spend),clickToLead:divide(leads,clicks),leadToSale:divide(sales,leads)};
}
function campaign(row:CampaignDbRow){
  const impressions=numeric(row.impressions),clicks=numeric(row.clicks),spend=numeric(row.spend),leads=numeric(row.leads),targetLeads=numeric(row.target_leads),arrived=numeric(row.arrived),sales=numeric(row.sales),revenue=numeric(row.revenue);
  return{platform:row.integration_slug,accountId:row.account_id,accountName:row.account_name,campaignId:row.campaign_id,campaignName:row.campaign_name,status:row.effective_status,currency:row.currency,impressions,clicks,spend,leads,targetLeads,arrived,sales,revenue,ctr:divide(clicks,impressions),cpc:divide(spend,clicks),cpm:divide(spend,impressions)*1000,cpl:divide(spend,leads),cpa:divide(spend,sales),roas:divide(revenue,spend)};
}
function trend(row:TrendDbRow){return{date:row.metric_date,impressions:numeric(row.impressions),clicks:numeric(row.clicks),spend:numeric(row.spend),leads:numeric(row.leads),targetLeads:numeric(row.target_leads),arrived:numeric(row.arrived),sales:numeric(row.sales),revenue:numeric(row.revenue)}}
function funnel(summary:ReturnType<typeof totals>){const stages=[['impressions','Показы',summary.impressions],['clicks','Клики',summary.clicks],['leads','Лиды',summary.leads],['targetLeads','Целевые лиды',summary.targetLeads],['arrived','Визиты',summary.arrived],['sales','Продажи',summary.sales]] as const;return stages.map(([key,label,value],index)=>({key,label,value,conversionFromPrevious:index===0?1:divide(value,stages[index-1][2]),conversionFromStart:index===0?1:divide(value,stages[0][2])}))}

function scope(input:Input,from:string,to:string,flags:{currency?:boolean;search?:boolean;status?:boolean}={}){
  const {currency=true,search=true,status=true}=flags;
  const values:unknown[]=[input.agencyId,input.clientId,from,to,metricKeys];
  const filters=['m.agency_id=$1','m.client_id=$2','m.metric_date between $3 and $4','m.metric_key=any($5::text[])',"m.entity_type=any(array['campaign','adgroup','ad']::text[])","coalesce(nullif(m.dimensions->>'campaign_id',''),nullif(m.entity_id,'')) is not null"];
  if(input.platform!=='all'){values.push(input.platform);filters.push(`m.integration_slug=$${values.length}`)}
  if(input.accountId){values.push(input.accountId);filters.push(`coalesce(nullif(m.dimensions->>'account_id',''),'unknown')=$${values.length}`)}
  if(status&&input.status){values.push(input.status);filters.push(`upper(coalesce(nullif(m.dimensions->>'effective_status',''),'UNKNOWN'))=upper($${values.length})`)}
  if(currency&&input.currency){values.push(input.currency);filters.push(`upper(coalesce(nullif(m.dimensions->>'currency',''),'KZT'))=$${values.length}`)}
  if(search&&input.search){values.push(`%${input.search}%`);filters.push(`(coalesce(m.dimensions->>'campaign_name',m.entity_name,'') ilike $${values.length} or coalesce(m.dimensions->>'account_name','') ilike $${values.length})`)}
  return{values,filters};
}
function cte(filters:string){return`with scoped as (
  select m.data_source_id,m.metric_date,m.integration_slug,m.entity_type,
    coalesce(nullif(m.dimensions->>'account_id',''),'unknown') account_id,
    coalesce(nullif(m.dimensions->>'account_name',''),'Неизвестный аккаунт') account_name,
    coalesce(nullif(m.dimensions->>'campaign_id',''),m.entity_id) campaign_id,
    coalesce(nullif(m.dimensions->>'campaign_name',''),m.entity_name,'Без названия') campaign_name,
    upper(coalesce(nullif(m.dimensions->>'effective_status',''),'UNKNOWN')) effective_status,
    upper(coalesce(nullif(m.dimensions->>'currency',''),'KZT')) currency,m.metric_key,m.value,
    case m.entity_type when 'ad' then 1 when 'adgroup' then 2 when 'campaign' then 3 else 4 end entity_rank
  from public.marketing_daily_metrics m where ${filters}
), ranked as (
  select scoped.*,min(entity_rank) over(partition by data_source_id,integration_slug,metric_date,campaign_id,metric_key) min_rank from scoped
), facts as (select * from ranked where entity_rank=min_rank)`}

@Controller('v1/advertising')
export class AdvertisingController{
  constructor(private readonly db:Db,private readonly access:AccessService){}

  private async authorize(authorization:string,agencyId:string,clientId:string){
    const user=await verifyUserJwt(authorization);
    await this.access.requirePermission(user.userId,agencyId,'analytics.read');
    const allowed=await this.db.query(`select 1 from public.clients c where c.id=$1 and c.agency_id=$2 and (exists(select 1 from public.agency_memberships m where m.agency_id=c.agency_id and m.user_id=$3 and m.status='active') or exists(select 1 from public.client_users cu where cu.client_id=c.id and cu.user_id=$3 and cu.status='active'))`,[clientId,agencyId,user.userId]);
    if(!allowed.rowCount)throw new ForbiddenException('CLIENT_ACCESS_DENIED');
  }

  @Get('workspace')
  async workspace(@Headers('authorization')authorization:string,@Query()query:Record<string,unknown>){
    const input=parse<Input>(inputSchema,query);
    await this.authorize(authorization,input.agencyId,input.clientId);
    const dates=range(input);

    const optionScope=scope(input,dates.dateFrom,dates.dateTo,{currency:false,search:false,status:false});
    const options=await this.db.query<OptionRow>(`${cte(optionScope.filters.join(' and '))}
      select distinct integration_slug,account_id,account_name,effective_status,currency from facts order by integration_slug,account_name,effective_status,currency`,optionScope.values);
    const currencies=[...new Set(options.rows.map(row=>row.currency))].sort();
    const effectiveCurrency=input.currency||(currencies[0]??'KZT');
    const selected={...input,currency:effectiveCurrency};

    const summaryScope=scope(selected,dates.previousFrom,dates.dateTo);
    const summary=await this.db.query<MetricRow>(`${cte(summaryScope.filters.join(' and '))}
      select case when metric_date between $${summaryScope.values.length+1} and $${summaryScope.values.length+2} then 'current' else 'previous' end period,
        metric_key,sum(value)::numeric value
      from facts group by period,metric_key order by period,metric_key`,[...summaryScope.values,dates.dateFrom,dates.dateTo]);
    const current=totals(summary.rows,'current'),previous=totals(summary.rows,'previous');

    const campaignScope=scope(selected,dates.dateFrom,dates.dateTo);
    const offset=(input.page-1)*input.pageSize;
    const order:Record<Input['sortBy'],string>={
      campaignName:'campaign_name',accountName:'account_name',status:'effective_status',impressions:'impressions',clicks:'clicks',spend:'spend',leads:'leads',targetLeads:'target_leads',arrived:'arrived',sales:'sales',revenue:'revenue',
      ctr:'case when impressions>0 then clicks/impressions else 0 end',cpc:'case when clicks>0 then spend/clicks else 0 end',cpm:'case when impressions>0 then spend/impressions*1000 else 0 end',cpl:'case when leads>0 then spend/leads else 0 end',cpa:'case when sales>0 then spend/sales else 0 end',roas:'case when spend>0 then revenue/spend else 0 end',
    };
    const grouped=`${cte(campaignScope.filters.join(' and '))}, grouped as (
      select integration_slug,account_id,account_name,campaign_id,campaign_name,effective_status,currency,
      coalesce(sum(value) filter(where metric_key='impressions'),0)::numeric impressions,
      coalesce(sum(value) filter(where metric_key='clicks'),0)::numeric clicks,
      coalesce(sum(value) filter(where metric_key='spend'),0)::numeric spend,
      coalesce(sum(value) filter(where metric_key='leads'),0)::numeric leads,
      coalesce(sum(value) filter(where metric_key='target_leads'),0)::numeric target_leads,
      coalesce(nullif(sum(value) filter(where metric_key='arrived'),0),sum(value) filter(where metric_key='appointments'),0)::numeric arrived,
      coalesce(nullif(sum(value) filter(where metric_key='sales'),0),sum(value) filter(where metric_key='conversions'),0)::numeric sales,
      coalesce(sum(value) filter(where metric_key='revenue'),0)::numeric revenue
      from facts group by integration_slug,account_id,account_name,campaign_id,campaign_name,effective_status,currency)`;

    const [campaigns,totalResult,trendResult]=await Promise.all([
      this.db.query<CampaignDbRow>(`${grouped} select * from grouped order by ${order[input.sortBy]} ${input.sortDir},campaign_name asc limit $${campaignScope.values.length+1} offset $${campaignScope.values.length+2}`,[...campaignScope.values,input.pageSize,offset]),
      this.db.query<{total:number|string}>(`${grouped} select count(*)::int total from grouped`,campaignScope.values),
      this.db.query<TrendDbRow>(`${cte(campaignScope.filters.join(' and '))}
        select metric_date,
        coalesce(sum(value) filter(where metric_key='impressions'),0)::numeric impressions,
        coalesce(sum(value) filter(where metric_key='clicks'),0)::numeric clicks,
        coalesce(sum(value) filter(where metric_key='spend'),0)::numeric spend,
        coalesce(sum(value) filter(where metric_key='leads'),0)::numeric leads,
        coalesce(sum(value) filter(where metric_key='target_leads'),0)::numeric target_leads,
        coalesce(nullif(sum(value) filter(where metric_key='arrived'),0),sum(value) filter(where metric_key='appointments'),0)::numeric arrived,
        coalesce(nullif(sum(value) filter(where metric_key='sales'),0),sum(value) filter(where metric_key='conversions'),0)::numeric sales,
        coalesce(sum(value) filter(where metric_key='revenue'),0)::numeric revenue
        from facts group by metric_date order by metric_date`,campaignScope.values),
    ]);

    const platforms=[...new Set(options.rows.map(row=>row.integration_slug))].sort();
    const accountMap=new Map<string,{id:string;name:string;platform:string}>();for(const row of options.rows)accountMap.set(`${row.integration_slug}:${row.account_id}`,{id:row.account_id,name:row.account_name,platform:row.integration_slug});
    const accounts=[...accountMap.values()].sort((left,right)=>left.name.localeCompare(right.name));
    const statuses=[...new Set(options.rows.map(row=>row.effective_status))].sort();
    const total=numeric(totalResult.rows[0]?.total);
    return{
      range:dates,
      effectiveCurrency,
      currencySelectionRequired:currencies.length>1,
      filters:{platforms,accounts,statuses,currencies},
      current,
      previous,
      trend:trendResult.rows.map(trend),
      funnel:funnel(current),
      campaigns:{items:campaigns.rows.map(campaign),page:input.page,pageSize:input.pageSize,total,pages:Math.max(1,Math.ceil(total/input.pageSize))},
    };
  }
}
