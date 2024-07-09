import { Module } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../entities/user.entity';
import { Role, RoleSchema } from '../../entities/role.entity';
import { History, HistorySchema } from '../../entities/history.entity';
import { UserRepository } from '../../repositories/user.repository';
import { HistoryRepository } from '../../repositories/history.repository';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RoleRepository } from '../../repositories/role.repository';
import { MyLoggerService } from '../logger/logger.service';
import { HashService } from '../../services/hash.service';
import { Suggest, SuggestSchema } from '../../entities/suggest.entity';
import { SuggestRepository } from '../../repositories/suggest.repository';
import { SuggestService } from '../suggest/suggest.service';
import { LinkService } from '../link/link.service';
import { LinkRepository } from '../../repositories/link.repository';
import { Link, LinkSchema } from '../../entities/link.entity';
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
import { SinbyteRepository } from '../../repositories/sinbyte.repository';
import { Sinbyte, SinByteSchema } from '../../entities/sinbyte.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: History.name, schema: HistorySchema },
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
  providers: [
    { provide: 'HistoryRepositoryInterface', useClass: HistoryRepository },
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
    HistoryService,
    JwtService,
    UserService,
    MyLoggerService,
    HashService,
    SuggestService,
    LinkService,
    CheckLinkService,
  ],
  controllers: [HistoryController],
})
export class HistoryModule {}
