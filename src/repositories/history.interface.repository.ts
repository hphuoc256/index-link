import { BaseRepositoryInterface } from './base/base.interface.repository';
import { History } from '../entities/history.entity';

export interface HistoryRepositoryInterface
  extends BaseRepositoryInterface<History> {
  findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | any;
    },
  ): Promise<History>;

  findAllWithPagination(condition: any): Promise<any>;
}
