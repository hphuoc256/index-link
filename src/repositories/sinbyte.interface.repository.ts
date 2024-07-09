import { BaseRepositoryInterface } from './base/base.interface.repository';
import { Sinbyte } from '../entities/sinbyte.entity';

export interface SinbyteRepositoryInterface
  extends BaseRepositoryInterface<Sinbyte> {
  findAllCondition(condition?: object): Promise<Sinbyte[]>;

  findAllByCondition(condition?: object): Promise<Sinbyte[] | any>;

  updateMany(condition?: object, set?: object);
}
