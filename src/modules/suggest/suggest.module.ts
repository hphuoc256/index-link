import { Module } from '@nestjs/common';
import { SuggestController } from './suggest.controller';
import { SuggestService } from './suggest.service';
import { JwtService } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../entities/user.entity';
import { Role, RoleSchema } from '../../entities/role.entity';
import { Suggest, SuggestSchema } from '../../entities/suggest.entity';
import { UserRepository } from '../../repositories/user.repository';
import { RoleRepository } from '../../repositories/role.repository';
import { SuggestRepository } from '../../repositories/suggest.repository';
import { MyLoggerService } from '../logger/logger.service';
import { UserService } from '../user/user.service';
import { LinkRepository } from '../../repositories/link.repository';
import { LinkService } from '../link/link.service';
import { Link, LinkSchema } from '../../entities/link.entity';
import { HashService } from '../../services/hash.service';
import { CheckLinkService } from '../../services/checkLink.service';
import { WebsiteRepository } from '../../repositories/website.repository';
import { Website, WebsiteSchema } from '../../entities/website.entity';
import { UserWebsiteRepository } from '../../repositories/userwebsite.repository';
import {
  UserWebsite,
  UserWebsiteSchema,
} from '../../entities/userwebsite.entity';
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
  controllers: [SuggestController],
  providers: [
    SuggestService,
    JwtService,
    MyLoggerService,
    UserService,
    LinkService,
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
export class SuggestModule {}
