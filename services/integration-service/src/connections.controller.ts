import {Body,Controller,Delete,Headers,Param,Post,UnauthorizedException} from '@nestjs/common';
import {verifyUserJwt} from './security.js';
import {ConnectionsService} from './connections.service.js';

async function currentUser(auth?:string){
  if(!auth?.startsWith('Bearer '))throw new UnauthorizedException();
  return verifyUserJwt(auth.slice(7));
}

@Controller('v1/connections')
export class ConnectionsController{
  constructor(private readonly connections:ConnectionsService){}

  @Post('manual')
  async manual(@Headers('authorization')auth:string,@Body()body:any){
    return this.connections.manualAttach((await currentUser(auth)).userId,body);
  }

  @Post('accounts/:id/revoke')
  async revokeAccount(@Param('id')id:string,@Headers('authorization')auth:string){
    return this.connections.revokeAccount((await currentUser(auth)).userId,id);
  }

  @Post(':id/sync')
  async sync(@Param('id')id:string,@Headers('authorization')auth:string,@Body()body:any){
    return this.connections.enqueueSync((await currentUser(auth)).userId,id,body??{});
  }

  @Post(':id/status')
  async status(@Param('id')id:string,@Headers('authorization')auth:string,@Body()body:any){
    return this.connections.setStatus((await currentUser(auth)).userId,id,body?.action);
  }

  @Delete(':id')
  async remove(@Param('id')id:string,@Headers('authorization')auth:string){
    return this.connections.remove((await currentUser(auth)).userId,id);
  }
}
