import {BadRequestException,Body,Controller,Get,Headers,Param,Put,Query} from '@nestjs/common';
import {z} from 'zod';
import {Db} from './db.js';
import {AccessService,verifyUserJwt} from './security.js';

const uuid=z.string().uuid();
const blockSchema=z.object({id:z.string().uuid().optional(),type:z.enum(['section','text','image','widget','page_break']),title:z.string().max(160).default(''),content:z.record(z.string(),z.unknown()).default({}),settings:z.record(z.string(),z.unknown()).default({})});
const pageSchema=z.object({id:z.string().uuid().optional(),title:z.string().trim().min(1).max(120),settings:z.record(z.string(),z.unknown()).default({}),blocks:z.array(blockSchema).max(200)});
const saveSchema=z.object({agencyId:uuid,revision:z.number().int().positive(),name:z.string().trim().min(1).max(160),description:z.string().max(2000).default(''),settings:z.record(z.string(),z.unknown()).default({}),branding:z.record(z.string(),z.unknown()).default({}),pages:z.array(pageSchema).min(1).max(100)});
const parse=<T>(schema:z.ZodType<T>,value:unknown):T=>{const result=schema.safeParse(value);if(!result.success)throw new BadRequestException(result.error.flatten());return result.data};

type ReportRow={id:string;agency_id:string;client_id:string|null;name:string;description:string;status:string;revision:number;settings:Record<string,unknown>;branding:Record<string,unknown>;updated_at:string};
type PageRow={id:string;report_id:string;title:string;position:number;settings:Record<string,unknown>};
type BlockRow={id:string;page_id:string;type:'section'|'text'|'image'|'widget'|'page_break';title:string;position:number;content:Record<string,unknown>;settings:Record<string,unknown>};

@Controller('v1/report-builder')
export class ReportBuilderController{
 constructor(private readonly db:Db,private readonly access:AccessService){}

 @Get(':reportId')
 async get(@Headers('authorization')auth:string,@Param('reportId')reportId:string,@Query('agencyId')agencyId:string){
  const user=await verifyUserJwt(auth);parse(uuid,reportId);parse(uuid,agencyId);await this.access.requirePermission(user.userId,agencyId,'reports.read');
  const report=await this.db.query<ReportRow>(`select id,agency_id,client_id,name,description,status,revision,settings,branding,updated_at from public.reports where id=$1 and agency_id=$2 and (client_id is null or exists(select 1 from public.clients c where c.id=client_id and (exists(select 1 from public.agency_memberships am where am.agency_id=c.agency_id and am.user_id=$3 and am.status='active') or exists(select 1 from public.client_users cu where cu.client_id=c.id and cu.user_id=$3))))`,[reportId,agencyId,user.userId]);
  if(!report.rows[0])throw new BadRequestException('REPORT_NOT_FOUND');
  const pages=await this.db.query<PageRow>(`select id,report_id,title,position,settings from public.report_pages where report_id=$1 and agency_id=$2 order by position`,[reportId,agencyId]);
  const pageIds=pages.rows.map(page=>page.id);const blocks=pageIds.length?await this.db.query<BlockRow>(`select id,page_id,type,title,position,content,settings from public.report_blocks where agency_id=$1 and page_id=any($2::uuid[]) order by page_id,position`,[agencyId,pageIds]):{rows:[] as BlockRow[]};
  return this.mapDocument(report.rows[0],pages.rows,blocks.rows);
 }

 @Put(':reportId')
 async save(@Headers('authorization')auth:string,@Param('reportId')reportId:string,@Body()body:unknown){
  const user=await verifyUserJwt(auth);parse(uuid,reportId);const input=parse(saveSchema,body);await this.access.requirePermission(user.userId,input.agencyId,'reports.manage');
  return this.db.transaction(async client=>{
   const current=await client.query<ReportRow>(`select id,agency_id,client_id,name,description,status,revision,settings,branding,updated_at from public.reports where id=$1 and agency_id=$2 for update`,[reportId,input.agencyId]);
   if(!current.rows[0])throw new BadRequestException('REPORT_NOT_FOUND');if(current.rows[0].revision!==input.revision)throw new BadRequestException('REPORT_REVISION_CONFLICT');
   await client.query(`update public.reports set name=$3,description=$4,settings=$5,branding=$6,revision=revision+1,updated_by=$7 where id=$1 and agency_id=$2`,[reportId,input.agencyId,input.name,input.description,input.settings,input.branding,user.userId]);
   await client.query(`delete from public.report_pages where report_id=$1 and agency_id=$2`,[reportId,input.agencyId]);
   for(let pagePosition=0;pagePosition<input.pages.length;pagePosition++){
    const page=input.pages[pagePosition];const inserted=await client.query<{id:string}>(`insert into public.report_pages(report_id,agency_id,title,position,settings) values($1,$2,$3,$4,$5) returning id`,[reportId,input.agencyId,page.title,pagePosition,page.settings]);const pageId=inserted.rows[0].id;
    for(let blockPosition=0;blockPosition<page.blocks.length;blockPosition++){const block=page.blocks[blockPosition];await client.query(`insert into public.report_blocks(page_id,agency_id,type,title,position,content,settings) values($1,$2,$3,$4,$5,$6,$7)`,[pageId,input.agencyId,block.type,block.title,blockPosition,block.content,block.settings])}
   }
   const saved=await client.query<ReportRow>(`select id,agency_id,client_id,name,description,status,revision,settings,branding,updated_at from public.reports where id=$1`,[reportId]);const pages=await client.query<PageRow>(`select id,report_id,title,position,settings from public.report_pages where report_id=$1 order by position`,[reportId]);const pageIds=pages.rows.map(page=>page.id);const blocks=await client.query<BlockRow>(`select id,page_id,type,title,position,content,settings from public.report_blocks where page_id=any($1::uuid[]) order by page_id,position`,[pageIds]);return this.mapDocument(saved.rows[0],pages.rows,blocks.rows);
  });
 }

 @Get(':reportId/widgets')
 async widgets(@Headers('authorization')auth:string,@Param('reportId')reportId:string,@Query('agencyId')agencyId:string){const user=await verifyUserJwt(auth);parse(uuid,reportId);parse(uuid,agencyId);await this.access.requirePermission(user.userId,agencyId,'reports.read');const result=await this.db.query<{id:string;title:string;type:string;dashboard_name:string}>(`select w.id,w.title,w.type,d.name dashboard_name from public.reports r join public.dashboards d on d.client_id=r.client_id and d.agency_id=r.agency_id join public.dashboard_sections s on s.dashboard_id=d.id join public.widgets w on w.section_id=s.id where r.id=$1 and r.agency_id=$2 order by d.position,s.position,w.y,w.x limit 250`,[reportId,agencyId]);return{items:result.rows.map(row=>({id:row.id,title:row.title,type:row.type,dashboardName:row.dashboard_name}))}}

 private mapDocument(report:ReportRow,pages:PageRow[],blocks:BlockRow[]){return{id:report.id,agencyId:report.agency_id,clientId:report.client_id,name:report.name,description:report.description,status:report.status,revision:report.revision,settings:report.settings,branding:report.branding,updatedAt:report.updated_at,pages:pages.map(page=>({id:page.id,title:page.title,settings:page.settings,blocks:blocks.filter(block=>block.page_id===page.id).map(block=>({id:block.id,type:block.type,title:block.title,content:block.content,settings:block.settings}))}))}}
}
