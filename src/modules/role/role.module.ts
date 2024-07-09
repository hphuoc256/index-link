import { Module } from '@nestjs/common';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema } from '../../entities/role.entity';
import { JwtService } from '@nestjs/jwt';
import { RoleRepository } from '../../repositories/role.repository';
import { MyLoggerService } from '../logger/logger.service';
import { UserService } from '../user/user.service';
import { UserRepository } from '../../repositories/user.repository';
import { User, UserSchema } from '../../entities/user.entity';
import { HashService } from '../../services/hash.service';
import { Website, WebsiteSchema } from '../../entities/website.entity';
import { WebsiteRepository } from '../../repositories/website.repository';
import { UserWebsiteRepository } from '../../repositories/userwebsite.repository';
import {
  UserWebsite,
  UserWebsiteSchema,
} from '../../entities/userwebsite.entity';
import { TelegramRepository } from '../../repositories/telegram.repository';
import { Telegram, TelegramSchema } from '../../entities/telegram.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: UserWebsite.name, schema: UserWebsiteSchema },
      { name: Telegram.name, schema: TelegramSchema },
    ]),
  ],
  controllers: [RoleController],
  providers: [
    RoleService,
    JwtService,
    MyLoggerService,
    UserService,
    HashService,
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    {
      provide: 'UserRepositoryInterface',
      useClass: UserRepository,
    },
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
export class RoleModule {}
