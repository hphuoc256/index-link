import { UserWebsite } from 'src/entities/userwebsite.entity';
import { BaseRepositoryInterface } from './base/base.interface.repository';

export interface UserWebsiteRepositoryInterface
  extends BaseRepositoryInterface<UserWebsite> {
  findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | any;
    },
  ): Promise<UserWebsite>;

  findOneByConditionWithSubField(
    condition?: object,
    options?: {
      populate?: string[] | any;
    },
  ): Promise<UserWebsite>;

  findById(id: string): Promise<UserWebsite | null>;

  findAllByCondition(condition?: object): Promise<UserWebsite[] | any>;
}
