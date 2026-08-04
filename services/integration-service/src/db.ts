import {Injectable,OnModuleDestroy} from '@nestjs/common';
import pg,{type QueryResultRow} from 'pg';
import {config} from './config.js';

@Injectable()
export class Db implements OnModuleDestroy{
  readonly pool=new pg.Pool({
    connectionString:config.DATABASE_URL,
    max:10,
    ssl:config.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false},
  });

  query<T extends QueryResultRow=QueryResultRow>(text:string,values:unknown[]=[]){
    return this.pool.query<T>(text,values);
  }

  async onModuleDestroy(){
    await this.pool.end();
  }
}
