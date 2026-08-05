import {Body,Controller,Get,Headers,Module,Param,Post,Query,Res,UnauthorizedException} from '@nestjs/common';
import type {FastifyReply} from 'fastify';
import {Db} from './db.js';
import {OAuthService} from './oauth.service.js';
import {config} from './config.js';
import {verifyUserJwt} from './security.js';
import type {Provider} from './providers.js';
import {ConnectionsController} from './connections.controller.js';
import {ConnectionsService} from './connections.service.js';
import {IntegrationsController} from './integrations.controller.js';
import {IntegrationsService} from './integrations.service.js';

async function user(auth?:string){
  if(!auth?.startsWith('Bearer '))throw new UnauthorizedException();
  return verifyUserJwt(auth.slice(7));
}

@Controller('v1/oauth')
class OAuthController{
  constructor(private readonly oauth:OAuthService){}

  @Post(':provider/start')
  async start(@Param('provider')provider:Provider,@Headers('authorization')auth:string,@Body()body:any){
    return this.oauth.start((await user(auth)).userId,provider,body);
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider')provider:Provider,
    @Query('code')code:string|undefined,
    @Query('auth_code')authCode:string|undefined,
    @Query('state')state:string,
    @Res()reply:FastifyReply,
  ){
    const authorizationCode=provider==='tiktok-ads'?authCode||code:code;
    const result=await this.oauth.callback(provider,authorizationCode||'',state);
    const payload=JSON.stringify({type:'imds-oauth-complete',...result}).replace(/</g,'\\u003c');
    return reply.type('text/html').send(`<!doctype html><script>window.opener&&window.opener.postMessage(${payload},${JSON.stringify(result.origin)});window.close()</script><p>Connection completed. You can close this window.</p>`);
  }

  @Get('connections/:handle/accounts')
  async accounts(@Param('handle')handle:string,@Headers('authorization')auth:string){
    return this.oauth.accounts((await user(auth)).userId,handle);
  }

  @Post('connections/attach')
  async attach(@Headers('authorization')auth:string,@Body()body:any){
    return this.oauth.attach((await user(auth)).userId,body);
  }
}

@Controller('internal/v1')
class InternalController{
  constructor(private readonly oauth:OAuthService){}

  @Get('credentials/:handle')
  credential(@Param('handle')handle:string,@Query('provider')provider:string,@Headers('authorization')auth:string){
    if(auth!==`Bearer ${config.INTERNAL_SERVICE_TOKEN}`)throw new UnauthorizedException();
    return this.oauth.credential(handle,provider);
  }
}

@Module({
  controllers:[OAuthController,ConnectionsController,IntegrationsController,InternalController],
  providers:[Db,OAuthService,ConnectionsService,IntegrationsService],
})
export class AppModule{}
