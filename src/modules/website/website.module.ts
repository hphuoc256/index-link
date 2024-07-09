import { Module } from '@nestjs/common';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/entities/user.entity';
import { Role, RoleSchema } from 'src/entities/role.entity';
import { Suggest, SuggestSchema } from 'src/entities/suggest.entity';
import { JwtService } from '@nestjs/jwt';
import { MyLoggerService } from '../logger/logger.service';
import { UserRepository } from 'src/repositories/user.repository';
import { RoleRepository } from 'src/repositories/role.repository';
import { SuggestRepository } from 'src/repositories/suggest.repository';
import { WebsiteRepository } from 'src/repositories/website.repository';
import { UserWebsiteService } from '../userwebsite/userwebsite.service';
import { UserWebsiteRepository } from 'src/repositories/userwebsite.repository';
import {
  UserWebsite,
  UserWebsiteSchema,
} from 'src/entities/userwebsite.entity';
import { Website, WebsiteSchema } from 'src/entities/website.entity';
import { UserService } from '../user/user.service';
import { HashService } from '../../services/hash.service';
import { SuggestService } from '../suggest/suggest.service';
import { Link, LinkSchema } from '../../entities/link.entity';
import { LinkRepository } from '../../repositories/link.repository';
import { LinkService } from '../link/link.service';
import { CheckLinkService } from '../../services/checkLink.service';
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
      { name: UserWebsite.name, schema: UserWebsiteSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: Link.name, schema: LinkSchema },
      { name: Telegram.name, schema: TelegramSchema },
      { name: Sinbyte.name, schema: SinByteSchema },
    ]),
  ],
  controllers: [WebsiteController],
  providers: [
    WebsiteService,
    UserService,
    JwtService,
    MyLoggerService,
    UserWebsiteService,
    HashService,
    SuggestService,
    LinkService,
    CheckLinkService,
    { provide: 'UserRepositoryInterface', useClass: UserRepository },
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    { provide: 'SuggestRepositoryInterface', useClass: SuggestRepository },
    { provide: 'WebsiteRepositoryInterface', useClass: WebsiteRepository },
    { provide: 'LinkRepositoryInterface', useClass: LinkRepository },
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
export class WebsiteModule {}
