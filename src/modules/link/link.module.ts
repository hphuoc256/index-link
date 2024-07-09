import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Suggest, SuggestSchema } from 'src/entities/suggest.entity';
import { Link, LinkSchema } from 'src/entities/link.entity';
import { Role, RoleSchema } from 'src/entities/role.entity';
import { User, UserSchema } from 'src/entities/user.entity';
import { LinkController } from './link.controller';
import { LinkService } from './link.service';
import { JwtService } from '@nestjs/jwt';
import { MyLoggerService } from '../logger/logger.service';
import { UserRepository } from 'src/repositories/user.repository';
import { LinkRepository } from 'src/repositories/link.repository';
import { SuggestRepository } from 'src/repositories/suggest.repository';
import { UserService } from '../user/user.service';
import { RoleRepository } from '../../repositories/role.repository';
import { HashService } from '../../services/hash.service';
import { CheckLinkService } from '../../services/checkLink.service';
import { WebsiteRepository } from '../../repositories/website.repository';
import { Website, WebsiteSchema } from '../../entities/website.entity';
import {
  UserWebsite,
  UserWebsiteSchema,
} from '../../entities/userwebsite.entity';
import { UserWebsiteRepository } from '../../repositories/userwebsite.repository';
import { TelegramRepository } from '../../repositories/telegram.repository';
import { Telegram, TelegramSchema } from '../../entities/telegram.entity';
import { Sinbyte, SinByteSchema } from '../../entities/sinbyte.entity';
import { SinbyteRepository } from '../../repositories/sinbyte.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Suggest.name, schema: SuggestSchema },
      { name: Link.name, schema: LinkSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: UserWebsite.name, schema: UserWebsiteSchema },
      { name: Telegram.name, schema: TelegramSchema },
      { name: Sinbyte.name, schema: SinByteSchema },
    ]),
  ],
  controllers: [LinkController],
  providers: [
    LinkService,
    JwtService,
    MyLoggerService,
    UserService,
    HashService,
    CheckLinkService,
    { provide: 'UserRepositoryInterface', useClass: UserRepository },
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    { provide: 'SuggestRepositoryInterface', useClass: SuggestRepository },
    { provide: 'LinkRepositoryInterface', useClass: LinkRepository },
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
    {
      provide: 'SinbyteRepositoryInterface',
      useClass: SinbyteRepository,
    },
  ],
})
export class LinkModule {}
