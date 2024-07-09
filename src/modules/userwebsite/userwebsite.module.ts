import { Module } from '@nestjs/common';
import { UserwebsiteController } from './userwebsite.controller';
import { UserWebsiteService } from './userwebsite.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/entities/user.entity';
import { Role, RoleSchema } from 'src/entities/role.entity';
import { SuggestSchema } from 'src/entities/suggest.entity';
import { JwtService } from '@nestjs/jwt';
import { MyLoggerService } from '../logger/logger.service';
import { UserRepository } from 'src/repositories/user.repository';
import { RoleRepository } from 'src/repositories/role.repository';
import { Website, WebsiteSchema } from 'src/entities/website.entity';
import { WebsiteRepository } from 'src/repositories/website.repository';
import { UserWebsiteRepository } from 'src/repositories/userwebsite.repository';
import {
  UserWebsite,
  UserWebsiteSchema,
} from 'src/entities/userwebsite.entity';
import { UserService } from '../user/user.service';
import { HashService } from '../../services/hash.service';
import { TelegramRepository } from '../../repositories/telegram.repository';
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
  controllers: [UserwebsiteController],
  providers: [
    UserWebsiteService,
    UserService,
    JwtService,
    MyLoggerService,
    HashService,
    { provide: 'UserRepositoryInterface', useClass: UserRepository },
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    { provide: 'WebsiteRepositoryInterface', useClass: WebsiteRepository },
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
export class UserWebsiteModule {}
