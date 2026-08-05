import {Injectable,ServiceUnavailableException} from '@nestjs/common';
import {config} from './config.js';
type GenerateInput={model:string;system:string;user:string;temperature:number};
type GenerateResult={text:string;usage:{promptTokens:number;completionTokens:number;totalTokens:number};raw:unknown};
@Injectable()
export class ProviderGateway{
  async generate(input:GenerateInput):Promise<GenerateResult>{
    if(!config.AI_PROVIDER_API_KEY)throw new ServiceUnavailableException('AI_PROVIDER_NOT_CONFIGURED');
    const response=await fetch(`${config.AI_PROVIDER_BASE_URL.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{authorization:`Bearer ${config.AI_PROVIDER_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:input.model,messages:[{role:'system',content:input.system},{role:'user',content:input.user}],temperature:input.temperature})});
    const payload:any=await response.json().catch(()=>null);
    if(!response.ok)throw new ServiceUnavailableException(payload?.error?.message||`AI_PROVIDER_HTTP_${response.status}`);
    const text=String(payload?.choices?.[0]?.message?.content??'').trim();
    if(!text)throw new ServiceUnavailableException('AI_PROVIDER_EMPTY_RESPONSE');
    return{text,usage:{promptTokens:Number(payload?.usage?.prompt_tokens||0),completionTokens:Number(payload?.usage?.completion_tokens||0),totalTokens:Number(payload?.usage?.total_tokens||0)},raw:payload};
  }
}
