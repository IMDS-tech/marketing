import {BadGatewayException,Injectable,ServiceUnavailableException} from '@nestjs/common';

interface AuthUser{ id:string; email?:string }

@Injectable()
export class AuthAdminService{
  private readonly url=(process.env.SUPABASE_URL??'').replace(/\/$/,'');
  private readonly key=process.env.SUPABASE_SERVICE_ROLE_KEY??'';
  private headers(){return{apikey:this.key,authorization:`Bearer ${this.key}`,'content-type':'application/json'}}
  private ensureConfigured(){if(!this.url||!this.key)throw new ServiceUnavailableException('SUPABASE_AUTH_ADMIN_NOT_CONFIGURED')}

  async findUserByEmail(email:string):Promise<AuthUser|null>{
    this.ensureConfigured();
    const normalized=email.trim().toLowerCase();
    for(let page=1;page<=10;page++){
      const response=await fetch(`${this.url}/auth/v1/admin/users?page=${page}&per_page=100`,{headers:this.headers()});
      if(!response.ok)throw new BadGatewayException(`AUTH_USER_LOOKUP_${response.status}`);
      const payload=await response.json() as {users?:AuthUser[]};
      const users=payload.users??[];
      const found=users.find(user=>user.email?.toLowerCase()===normalized);
      if(found)return found;
      if(users.length<100)break;
    }
    return null;
  }

  async invite(email:string,redirectTo?:string):Promise<AuthUser>{
    this.ensureConfigured();
    const response=await fetch(`${this.url}/auth/v1/invite${redirectTo?`?redirect_to=${encodeURIComponent(redirectTo)}`:''}`,{
      method:'POST',headers:this.headers(),body:JSON.stringify({email:email.trim().toLowerCase()})
    });
    const payload=await response.json().catch(()=>({})) as AuthUser&{message?:string;msg?:string};
    if(!response.ok)throw new BadGatewayException(payload.message??payload.msg??`AUTH_INVITE_${response.status}`);
    return payload;
  }
}
