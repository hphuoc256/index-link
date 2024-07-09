import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { MyLoggerService } from '../logger/logger.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Suggest, SuggestSchema } from '../../entities/suggest.entity';
import { Config, ConfigSchema } from '../../entities/config.entity';
import { Job, JobSchema } from '../../entities/job.entity';
import { History, HistorySchema } from '../../entities/history.entity';
import { Link, LinkSchema } from '../../entities/link.entity';
import { Website, WebsiteSchema } from '../../entities/website.entity';
import { TelegramService } from '../telegram/telegram.service';
import { CheckLinkService } from '../../services/checkLink.service';
import {
  NotificationSchema,
  Notification,
} from '../../entities/notification.entity';
import { EventGateway } from '../event/event.gateway';
import { JobLockService } from './job-lock.service';
import { LinkService } from '../link/link.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: Config.name, schema: ConfigSchema },
      { name: History.name, schema: HistorySchema },
      { name: Link.name, schema: LinkSchema },
      { name: Suggest.name, schema: SuggestSchema },
      { name: Website.name, schema: WebsiteSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [
    JobService,
    MyLoggerService,
    TelegramService,
    CheckLinkService,
    EventGateway,
    JobLockService,
    LinkService,
  ],
})
export class JobModule {}
