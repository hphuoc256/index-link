import { BaseRepositoryInterface } from './base/base.interface.repository';
import { Config } from '../entities/config.entity';

export interface ConfigRepositoryInterface
  extends BaseRepositoryInterface<Config> {
  findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | any;
    },
  ): Promise<Config>;
}
