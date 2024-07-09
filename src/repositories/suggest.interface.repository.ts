import { BaseRepositoryInterface } from './base/base.interface.repository';
import { Suggest } from '../entities/suggest.entity';

export interface SuggestRepositoryInterface
  extends BaseRepositoryInterface<Suggest> {
  findById(id: string): Promise<Suggest | null>;

  findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | any;
    },
  ): Promise<Suggest>;

  getSuggestCondition(condition?: object): Promise<any>;

  findAllByCondition(condition?: object): Promise<Suggest[] | any>;
}
