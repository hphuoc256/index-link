import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../entities/user.entity';
import { Role, RoleSchema } from '../../entities/role.entity';
import { Suggest, SuggestSchema } from '../../entities/suggest.entity';
import { JwtService } from '@nestjs/jwt';
import { MyLoggerService } from '../logger/logger.service';
import { UserService } from '../user/user.service';
import { UserRepository } from '../../repositories/user.repository';
import { RoleRepository } from '../../repositories/role.repository';
import { SuggestRepository } from '../../repositories/suggest.repository';
import { ConfigRepository } from '../../repositories/config.repository';
import { Config, ConfigSchema } from '../../entities/config.entity';
import { LinkRepository } from '../../repositories/link.repository';
import { Link, LinkSchema } from '../../entities/link.entity';
import { Website, WebsiteSchema } from '../../entities/website.entity';
import { HashService } from '../../services/hash.service';
import { TelegramService } from '../telegram/telegram.service';
import { History, HistorySchema } from '../../entities/history.entity';
import { JobService } from '../job/job.service';
import { Job, JobSchema } from '../../entities/job.entity';
import { CheckLinkService } from '../../services/checkLink.service';
import {
  Notification,
  NotificationSchema,
} from '../../entities/notification.entity';
import { Telegram, TelegramSchema } from '../../entities/telegram.entity';
import { TelegramRepository } from '../../repositories/telegram.repository';
import { WebsiteRepository } from '../../repositories/website.repository';
import { UserWebsiteRepository } from '../../repositories/userwebsite.repository';
import {
  UserWebsite,
  UserWebsiteSchema,
} from '../../entities/userwebsite.entity';
import { EventGateway } from '../event/event.gateway';
import { SuggestService } from '../suggest/suggest.service';
import { SinbyteRepository } from '../../repositories/sinbyte.repository';
import { Sinbyte, SinByteSchema } from '../../entities/sinbyte.entity';
import { JobLockService } from '../job/job-lock.service';
import { LinkService } from '../link/link.service';
import { JobLockCheckLinkIndexService } from '../job/job-lock-check-link-index.service';
import { JobLockIndexLinkService } from '../job/job-lock-index-link.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Suggest.name, schema: SuggestSchema },
      { name: Config.name, schema: ConfigSchema },
      { name: Link.name, schema: LinkSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: History.name, schema: HistorySchema },
      { name: Job.name, schema: JobSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Telegram.name, schema: TelegramSchema },
      { name: UserWebsite.name, schema: UserWebsiteSchema },
      { name: Sinbyte.name, schema: SinByteSchema },
    ]),
  ],
  controllers: [ConfigController],
  providers: [
    ConfigService,
    JwtService,
    MyLoggerService,
    UserService,
    HashService,
    TelegramService,
    JobService,
    CheckLinkService,
    EventGateway,
    SuggestService,
    JobLockService,
    LinkService,
    JobLockCheckLinkIndexService,
    JobLockIndexLinkService,
    { provide: 'UserRepositoryInterface', useClass: UserRepository },
    { provide: 'RoleRepositoryInterface', useClass: RoleRepository },
    { provide: 'SuggestRepositoryInterface', useClass: SuggestRepository },
    { provide: 'ConfigRepositoryInterface', useClass: ConfigRepository },
    { provide: 'LinkRepositoryInterface', useClass: LinkRepository },
    { provide: 'TelegramRepositoryInterface', useClass: TelegramRepository },
    {
      provide: 'WebsiteRepositoryInterface',
      useClass: WebsiteRepository,
    },
    {
      provide: 'UserWebsiteRepositoryInterface',
      useClass: UserWebsiteRepository,
    },
    {
      provide: 'SinbyteRepositoryInterface',
      useClass: SinbyteRepository,
    },
  ],
})
export class ConfigModule {}
