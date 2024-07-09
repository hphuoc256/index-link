import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { MyLoggerService } from '../logger/logger.service';
import { UserRepository } from '../../repositories/user.repository';
import { RoleRepository } from '../../repositories/role.repository';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { HashService } from '../../services/hash.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../entities/user.entity';
import { Role, RoleSchema } from '../../entities/role.entity';
import { TelegramRepository } from '../../repositories/telegram.repository';
import { Telegram, TelegramSchema } from '../../entities/telegram.entity';
import { WebsiteRepository } from '../../repositories/website.repository';
import { Website, WebsiteSchema } from '../../entities/website.entity';
import { UserWebsiteRepository } from '../../repositories/userwebsite.repository';
import {
  UserWebsite,
  UserWebsiteSchema,
} from '../../entities/userwebsite.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Telegram.name, schema: TelegramSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: UserWebsite.name, schema: UserWebsiteSchema },
    ]),
  ],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    MyLoggerService,
    { provide: 'UserRepositoryInterface', useClass: UserRepository },
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    { provide: 'TelegramRepositoryInterface', useClass: TelegramRepository },
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
export class TelegramModule {}
