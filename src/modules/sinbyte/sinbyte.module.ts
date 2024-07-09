import { Module } from '@nestjs/common';
import { SinbyteController } from './sinbyte.controller';
import { SinbyteService } from './sinbyte.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../entities/user.entity';
import { Role, RoleSchema } from '../../entities/role.entity';
import { Telegram, TelegramSchema } from '../../entities/telegram.entity';
import { Website, WebsiteSchema } from '../../entities/website.entity';
import {
  UserWebsite,
  UserWebsiteSchema,
} from '../../entities/userwebsite.entity';
import { MyLoggerService } from '../logger/logger.service';
import { UserRepository } from '../../repositories/user.repository';
import { RoleRepository } from '../../repositories/role.repository';
import { TelegramRepository } from '../../repositories/telegram.repository';
import { WebsiteRepository } from '../../repositories/website.repository';
import { UserWebsiteRepository } from '../../repositories/userwebsite.repository';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { HashService } from '../../services/hash.service';
import { SinbyteRepository } from '../../repositories/sinbyte.repository';
import { Sinbyte, SinByteSchema } from '../../entities/sinbyte.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Telegram.name, schema: TelegramSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: UserWebsite.name, schema: UserWebsiteSchema },
      { name: Sinbyte.name, schema: SinByteSchema },
    ]),
  ],
  controllers: [SinbyteController],
  providers: [
    SinbyteService,
    MyLoggerService,
    { provide: 'UserRepositoryInterface', useClass: UserRepository },
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    { provide: 'TelegramRepositoryInterface', useClass: TelegramRepository },
    { provide: 'SinbyteRepositoryInterface', useClass: SinbyteRepository },
    {
      provide: 'WebsiteRepositoryInterface',
      useClass: WebsiteRepository,
    },
    {
      provide: 'UserWebsiteRepositoryInterface',
      useClass: UserWebsiteRepository,
    },
    UserService,
    JwtService,
    HashService,
  ],
})
export class SinbyteModule {}
