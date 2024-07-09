import { BaseRepositoryInterface } from './base/base.interface.repository';
import { Telegram } from 'src/entities/telegram.entity';

export interface TelegramRepositoryInterface
  extends BaseRepositoryInterface<Telegram> {
  findAllCondition(condition?: object): Promise<Telegram[]>;

  findAllByCondition(condition?: object): Promise<Telegram[] | any>;

  updateMany(condition?: object, set?: object);
}
