import { Module } from '@nestjs/common';
import { EventGateway } from './event.gateway';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { UserRepository } from '../../repositories/user.repository';
import { RoleRepository } from '../../repositories/role.repository';
import { WebsiteRepository } from '../../repositories/website.repository';
import { UserWebsiteRepository } from '../../repositories/userwebsite.repository';
import { TelegramRepository } from '../../repositories/telegram.repository';
import { HashService } from '../../services/hash.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../entities/user.entity';
import { Role, RoleSchema } from '../../entities/role.entity';
import { Website, WebsiteSchema } from '../../entities/website.entity';
import {
  UserWebsite,
  UserWebsiteSchema,
} from '../../entities/userwebsite.entity';
import { Telegram, TelegramSchema } from '../../entities/telegram.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: UserWebsite.name, schema: UserWebsiteSchema },
      { name: Telegram.name, schema: TelegramSchema },
    ]),
  ],
  providers: [
    EventGateway,
    JwtService,
    UserService,
    HashService,
    { provide: 'UserRepositoryInterface', useClass: UserRepository },
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    {
      provide: 'WebsiteRepositoryInterface',
      useClass: WebsiteRepository,
    },
    {
      provide: 'UserWebsiteRepositoryInterface',
      useClass: UserWebsiteRepository,
    },
    {
      provide: 'TelegramRepositoryInterface',
      useClass: TelegramRepository,
    },
  ],
})
export class EventModule {}
