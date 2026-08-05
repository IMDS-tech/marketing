import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {AppModule} from './app.module.js';
import {config} from './config.js';

const app=await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({logger:true}));
app.enableCors({origin:config.APP_ORIGIN,credentials:true});
app.enableShutdownHooks();
await app.listen({port:config.PORT,host:'0.0.0.0'});
