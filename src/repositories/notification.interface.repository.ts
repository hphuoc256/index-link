import { BaseRepositoryInterface } from './base/base.interface.repository';
import { Notification } from '../entities/notification.entity';

export interface NotificationRepositoryInterface
  extends BaseRepositoryInterface<Notification> {}
