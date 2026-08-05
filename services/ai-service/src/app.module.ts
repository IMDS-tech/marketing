import {BadRequestException,Body,Controller,Get,Headers,Module,Post,Query} from '@nestjs/common';
import {z} from 'zod';
import {Db} from './db.js';
import {AccessService,verifyUserJwt} from './security.js';
import {ProviderGateway} from './provider.gateway.js';
import {AiService} from './ai.service.js';
import {config} from './config.js';
const uuid=z.string().uuid();const executeSchema=z.object({agencyId:uuid,clientId:uuid.nullable().optional(),templateKey:z.string().trim().min(1).max(100).default('general-assistant'),input:z.string().min(1),tools:z.array(z.enum(['search','metric-summary'])).max(4).default([]),temperature:z.number().min(0).max(2).optional(),idempotencyKey:z.string().max(160).optional()});
const parse=<T>(schema:z.ZodType<T>,value:unknown)=>{const result=schema.safeParse(value);if(!result.success)throw new BadRequestException(result.error.flatten());return result.data};
@Controller('health')class HealthController{@Get()health(){return{ok:true,service:'ai-service',providerConfigured:Boolean(config.AI_PROVIDER_API_KEY),tools:[...config.AI_ALLOWED_TOOLS]}}}
@Controller('v1/ai')class AiController{constructor(private readonly ai:AiService){}
@Get('templates')async templates(@Headers('authorization')auth:string,@Query('agencyId')agencyId:string){return this.ai.templates((await verifyUserJwt(auth)).userId,parse(uuid,agencyId))}
@Get('requests')async requests(@Headers('authorization')auth:string,@Query('agencyId')agencyId:string,@Query('limit')limit?:string){return this.ai.history((await verifyUserJwt(auth)).userId,parse(uuid,agencyId),Number(limit||50))}
@Post('execute')async execute(@Headers('authorization')auth:string,@Body()body:unknown){return this.ai.execute((await verifyUserJwt(auth)).userId,parse(executeSchema,body))}}
@Module({controllers:[HealthController,AiController],providers:[Db,AccessService,ProviderGateway,AiService]})export class AppModule{}
