import 'reflect-metadata';
import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {AdvertisingModule} from './advertising.module.js';
import {AppModule} from './app.module.js';
import {config} from './config.js';

@Module({imports:[AppModule,AdvertisingModule]})
class RuntimeModule{}

const app=await NestFactory.create<NestFastifyApplication>(RuntimeModule,new FastifyAdapter({logger:true}));
app.enableCors({origin:config.APP_ORIGIN,methods:['GET','POST','PATCH'],allowedHeaders:['authorization','content-type']});
app.enableShutdownHooks();
await app.listen(config.PORT,'0.0.0.0');
