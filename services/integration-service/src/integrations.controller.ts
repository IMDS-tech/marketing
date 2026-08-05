import {Body,Controller,Get,Headers,Param,Patch,Post,Query,UnauthorizedException} from '@nestjs/common';
import {verifyUserJwt} from './security.js';
import {IntegrationsService} from './integrations.service.js';

async function currentUser(auth?:string){
  if(!auth?.startsWith('Bearer '))throw new UnauthorizedException('AUTH_REQUIRED');
  return verifyUserJwt(auth.slice(7));
}

@Controller('v1/integrations')
export class IntegrationsController{
  constructor(private readonly integrations:IntegrationsService){}

  @Get('workspace')
  async workspace(
    @Headers('authorization')auth:string,
    @Query('agencyId')agencyId:string,
    @Query('clientId')clientId?:string,
  ){
    return this.integrations.workspace((await currentUser(auth)).userId,agencyId,clientId);
  }

  @Get('schema')
  async schema(
    @Headers('authorization')auth:string,
    @Query('agencyId')agencyId:string,
    @Query('integrationId')integrationId?:string,
  ){
    return this.integrations.schema((await currentUser(auth)).userId,agencyId,integrationId);
  }

  @Patch('sources/:id')
  async updateSource(
    @Headers('authorization')auth:string,
    @Param('id')id:string,
    @Body()body:{syncDepthDays?:number;settings?:Record<string,unknown>},
  ){
    return this.integrations.updateSource((await currentUser(auth)).userId,id,body||{});
  }

  @Post('jobs/:id/retry')
  async retryJob(
    @Headers('authorization')auth:string,
    @Param('id')id:string,
  ){
    return this.integrations.retryJob((await currentUser(auth)).userId,id);
  }
}
