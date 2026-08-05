import pg,{type QueryResultRow} from 'pg';import {config} from './config.js';
export class Db{readonly pool=new pg.Pool({connectionString:config.DATABASE_URL,max:6,ssl:config.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}});query<T extends QueryResultRow=QueryResultRow>(text:string,values:unknown[]=[]){return this.pool.query<T>(text,values)}close(){return this.pool.end()}}
