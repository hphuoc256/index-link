import { FilterQuery, Model, QueryOptions } from 'mongoose';
import { BaseRepositoryInterface } from './base.interface.repository';
import { BaseEntity } from '../../entities/base.entity';
import {
  FindAllResponse,
  Pagination,
  ResponseAllWithPaginate,
} from '../../types/global';
import { paginationQuery } from '../../utils';

export abstract class BaseRepositoryAbstract<T extends BaseEntity>
  implements BaseRepositoryInterface<T>
{
  protected constructor(private readonly model: Model<T>) {
    this.model = model;
  }

  async create(dto: T | any): Promise<T> {
    const createdData = new this.model(dto);
    return await createdData.save();
  }

  async findOneById(id: string): Promise<T> {
    const item = await this.model.findById(id);
    return item?.deleted_at ? null : item;
  }

  async findOneByCondition(condition = {}): Promise<T> {
    return await this.model
      .findOne({
        ...condition,
        deleted_at: null,
      })
      .exec();
  }

  async findAll(
    condition: FilterQuery<T>,
    options?: QueryOptions<T>,
  ): Promise<FindAllResponse<T>> {
    const [total, items] = await Promise.all([
      this.model.count({ ...condition, deleted_at: null }),
      this.model.find(
        { ...condition, deleted_at: null },
        options?.projection,
        options,
      ),
    ]);
    const paginate = paginationQuery(options as Pagination);
    return {
      pagination: {
        limit: paginate.limit,
        page: paginate.page || 1,
        total,
      },
      items,
    } as ResponseAllWithPaginate;
  }

  async update(id: string, dto: Partial<T>): Promise<T> {
    return this.model.findOneAndUpdate({ _id: id, deleted_at: null }, dto, {
      new: true,
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const deleteItem = await this.model.findById(id);
    if (!deleteItem) {
      return false;
    }

    return !!(await this.model
      .findByIdAndUpdate<T>(id, { deleted_at: new Date() })
      .exec());
  }

  async permanentlyDelete(id: string): Promise<boolean> {
    const deleteItem = await this.model.findById(id);
    if (!deleteItem) {
      return false;
    }
    return !!(await this.model.findByIdAndDelete(id));
  }

  async deleteManyByCondition(condition?: object): Promise<boolean> {
    await this.model.deleteMany(condition);
    return true;
  }
}
