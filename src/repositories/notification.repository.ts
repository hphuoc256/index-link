import { Notification } from 'src/entities/notification.entity';
import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationRepositoryInterface } from './notification.interface.repository';

export class NotificationRepository
  extends BaseRepositoryAbstract<Notification>
  implements NotificationRepositoryInterface
{
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {
    super(notificationModel);
  }
}
