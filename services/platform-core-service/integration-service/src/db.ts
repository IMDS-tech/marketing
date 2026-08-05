import {Injectable,OnModuleDestroy} from '@nestjs/common';
import pg,{type QueryResult,type QueryResultRow} from 'pg';
import {config} from './config.js';

type TransactionQuery=<T extends QueryResultRow=QueryResultRow>(text:string,values?:unknown[])=>Promise<QueryResult<T>>;

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

  async transaction<T>(work:(query:TransactionQuery)=>Promise<T>):Promise<T>{
    const client=await this.pool.connect();
    const query:TransactionQuery=(text,values=[])=>client.query(text,values);
    try{
      await client.query('begin');
      const result=await work(query);
      await client.query('commit');
      return result;
    }catch(error){
      await client.query('rollback');
      throw error;
    }finally{
      client.release();
    }
  }

  async onModuleDestroy(){await this.pool.end()}
}
