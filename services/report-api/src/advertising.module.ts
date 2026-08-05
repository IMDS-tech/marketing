import {Module} from '@nestjs/common';
import {AdvertisingController} from './advertising.controller.js';
import {AccessService} from './security.js';
import {Db} from './db.js';

@Module({controllers:[AdvertisingController],providers:[Db,AccessService]})
export class AdvertisingModule{}
