import { BaseRepositoryInterface } from './base/base.interface.repository';
import { Link } from '../entities/link.entity';
import { UpdateManyDto } from '../types/link';

export interface LinkRepositoryInterface extends BaseRepositoryInterface<Link> {
  findByIdWithSubFields(
    id: string,
    options: {
      populate?: string[] | any;
    },
  ): Promise<Link>;

  findById(id: string): Promise<Link | null>;

  findBySuggestIds(condition?: object): Promise<Link[]>;

  getTotalCondition(condition?: object): Promise<any>;

  createMany(data: any): Promise<any>;

  findAndUpdateByCondition(
    condition?: object,
    data?: UpdateManyDto,
  ): Promise<boolean>;
}
