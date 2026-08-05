import {BadRequestException,Body,Controller,Get,Headers,Param,Post,Query} from '@nestjs/common';
import {z} from 'zod';
import {Db} from './db.js';
import {AccessService,verifyUserJwt} from './security.js';

const uuid=z.string().uuid();const date=z.string().date();
const parse=<T>(schema:z.ZodType<T>,value:unknown):T=>{const result=schema.safeParse(value);if(!result.success)throw new BadRequestException(result.error.flatten());return result.data};
const aggregateSchema=z.object({agencyId:uuid,clientId:uuid,dateFrom:date,dateTo:date,metricKeys:z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1).max(25),groupBy:z.enum(['metric_date','integration_slug','metric_key','entity_type']).default('metric_date'),integrationSlugs:z.array(z.string().regex(/^[a-z0-9-]+$/)).max(25).default([]),filters:z.record(z.string(),z.union([z.string(),z.number(),z.boolean()])).default({})});

@Controller('v1/analytics')
export class AnalyticsController{
  constructor(private readonly db:Db,private readonly access:AccessService){}

  private async authorize(authorization:string,agencyId:string,clientId?:string){
    const user=await verifyUserJwt(authorization);parse(uuid,agencyId);await this.access.requirePermission(user.userId,agencyId,'reports.read');
    if(clientId){parse(uuid,clientId);const access=await this.db.query(`select 1 from public.clients c where c.id=$1 and c.agency_id=$2 and (exists(select 1 from public.agency_memberships m where m.agency_id=c.agency_id and m.user_id=$3 and m.status='active') or exists(select 1 from public.client_users cu where cu.client_id=c.id and cu.user_id=$3 and cu.status='active'))`,[clientId,agencyId,user.userId]);if(!access.rowCount)throw new BadRequestException('CLIENT_ACCESS_DENIED')}
    return user;
  }

  @Get('metrics')
  async metrics(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string,@Query('clientId')clientId:string,@Query('dateFrom')dateFrom:string,@Query('dateTo')dateTo:string,@Query('metricKey')metricKey?:string,@Query('integrationSlug')integrationSlug?:string,@Query('entityType')entityType?:string,@Query('limit')limit='1000'){
    await this.authorize(authorization,agencyId,clientId);parse(date,dateFrom);parse(date,dateTo);const values:unknown[]=[agencyId,clientId,dateFrom,dateTo];const filters=['agency_id=$1','client_id=$2','metric_date between $3 and $4'];
    if(metricKey){values.push(z.string().regex(/^[a-z][a-z0-9_]*$/).parse(metricKey));filters.push(`metric_key=$${values.length}`)}
    if(integrationSlug){values.push(z.string().regex(/^[a-z0-9-]+$/).parse(integrationSlug));filters.push(`integration_slug=$${values.length}`)}
    if(entityType){values.push(z.string().max(40).parse(entityType));filters.push(`entity_type=$${values.length}`)}
    values.push(Math.min(5000,Math.max(1,Number(limit)||1000)));
    const result=await this.db.query(`select data_source_id,integration_slug,entity_type,entity_id,entity_name,metric_date,metric_key,value,dimensions,source_updated_at,ingested_at from public.marketing_daily_metrics where ${filters.join(' and ')} order by metric_date desc limit $${values.length}`,values);
    return {items:result.rows};
  }

  @Post('aggregate')
  async aggregate(@Headers('authorization')authorization:string,@Body()body:unknown){
    const input=parse(aggregateSchema,body);await this.authorize(authorization,input.agencyId,input.clientId);const values:unknown[]=[input.agencyId,input.clientId,input.dateFrom,input.dateTo,input.metricKeys];const filters=['agency_id=$1','client_id=$2','metric_date between $3 and $4','metric_key=any($5::text[])'];
    if(input.integrationSlugs.length){values.push(input.integrationSlugs);filters.push(`integration_slug=any($${values.length}::text[])`)}
    for(const [key,value] of Object.entries(input.filters)){if(!/^[a-z][a-z0-9_]*$/.test(key))throw new BadRequestException('FILTER_KEY_INVALID');values.push(key,String(value));filters.push(`dimensions->>$${values.length-1}=$${values.length}`)}
    const group=input.groupBy;const result=await this.db.query(`select ${group} bucket,metric_key,sum(value)::numeric value,count(*)::int points from public.marketing_daily_metrics where ${filters.join(' and ')} group by ${group},metric_key order by ${group},metric_key`,values);
    return {groupBy:group,items:result.rows};
  }

  @Get('dashboard/:dashboardId')
  async dashboard(@Headers('authorization')authorization:string,@Param('dashboardId')dashboardId:string,@Query('agencyId')agencyId:string,@Query('dateFrom')dateFrom:string,@Query('dateTo')dateTo:string){
    parse(uuid,dashboardId);parse(date,dateFrom);parse(date,dateTo);const dashboard=await this.db.query<any>(`select id,agency_id,client_id,name,settings from public.dashboards where id=$1 and agency_id=$2`,[dashboardId,agencyId]);if(!dashboard.rows[0])throw new BadRequestException('DASHBOARD_NOT_FOUND');await this.authorize(authorization,agencyId,dashboard.rows[0].client_id);
    const sections=await this.db.query(`select id,title,position,settings from public.dashboard_sections where dashboard_id=$1 and agency_id=$2 order by position`,[dashboardId,agencyId]);
    const widgets=await this.db.query<any>(`select w.id,w.section_id,w.type,w.integration_slug,w.metric_key,w.dimension_key,w.filters_json,w.settings_json,w.x,w.y,w.w,w.h,w.color,w.title from public.widgets w join public.dashboard_sections s on s.id=w.section_id where s.dashboard_id=$1 and w.agency_id=$2 order by w.y,w.x`,[dashboardId,agencyId]);
    const widgetData=[] as unknown[];for(const widget of widgets.rows){if(!widget.metric_key){widgetData.push({widgetId:widget.id,items:[]});continue}const values:unknown[]=[agencyId,dashboard.rows[0].client_id,dateFrom,dateTo,widget.metric_key];const filters=['agency_id=$1','client_id=$2','metric_date between $3 and $4','metric_key=$5'];if(widget.integration_slug){values.push(widget.integration_slug);filters.push(`integration_slug=$${values.length}`)}const data=await this.db.query(`select metric_date,sum(value)::numeric value from public.marketing_daily_metrics where ${filters.join(' and ')} group by metric_date order by metric_date`,values);widgetData.push({widgetId:widget.id,items:data.rows})}
    return {dashboard:dashboard.rows[0],sections:sections.rows,widgets:widgets.rows,data:widgetData};
  }

  @Get('kpis')
  async kpis(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string,@Query('clientId')clientId:string,@Query('dateFrom')dateFrom:string,@Query('dateTo')dateTo:string){
    await this.authorize(authorization,agencyId,clientId);parse(date,dateFrom);parse(date,dateTo);const result=await this.db.query(`select metric_key,sum(value)::numeric value from public.marketing_daily_metrics where agency_id=$1 and client_id=$2 and metric_date between $3 and $4 and metric_key=any($5::text[]) group by metric_key`,[agencyId,clientId,dateFrom,dateTo,['impressions','clicks','spend','leads','conversions','revenue']]);const map=Object.fromEntries(result.rows.map((row:any)=>[row.metric_key,Number(row.value)]));return {items:map,derived:{ctr:map.impressions?map.clicks/map.impressions:0,cpl:map.leads?map.spend/map.leads:0,roas:map.spend?map.revenue/map.spend:0}};
  }

  @Get('rollups')
  async rollups(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string,@Query('dateFrom')dateFrom:string,@Query('dateTo')dateTo:string){
    await this.authorize(authorization,agencyId);parse(date,dateFrom);parse(date,dateTo);const result=await this.db.query(`select c.id client_id,c.company,metric_key,sum(m.value)::numeric value from public.clients c join public.marketing_daily_metrics m on m.client_id=c.id and m.agency_id=c.agency_id where c.agency_id=$1 and m.metric_date between $2 and $3 group by c.id,c.company,metric_key order by c.company,metric_key`,[agencyId,dateFrom,dateTo]);return {items:result.rows};
  }

  @Get('views')
  async views(@Headers('authorization')authorization:string,@Query('agencyId')agencyId:string){await this.authorize(authorization,agencyId);const result=await this.db.query(`select table_name,column_name,data_type from information_schema.columns where table_schema='public' and table_name=any($1::text[]) order by table_name,ordinal_position`,[['marketing_ads','marketing_daily_metrics']]);return {items:result.rows};}
}
