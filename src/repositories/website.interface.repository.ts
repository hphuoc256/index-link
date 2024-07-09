import { BaseRepositoryInterface } from './base/base.interface.repository';
import { Website } from '../entities/website.entity';
import { FilterInterface } from '../modules/website/interface/filter.interface';

export interface WebsiteRepositoryInterface
  extends BaseRepositoryInterface<Website> {
  findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | any;
    },
  ): Promise<Website>;

  findById(id: string): Promise<Website | null>;

  findAllWithSubFields(filter: FilterInterface): Promise<Website[]>;

  findByIdWithSubFields2(id: string, req): Promise<Website | null>;

  findAllByCondition(condition?: object): Promise<Website[] | any>;

  updateMany(condition?: object, set?: object);

  find(query: any): Promise<Website[]>;
}
