import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { RoleRepositoryInterface } from './role.interface.repository';
import { Role } from '../entities/role.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export class RoleRepository
  extends BaseRepositoryAbstract<Role>
  implements RoleRepositoryInterface
{
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
  ) {
    super(roleModel);
  }
  async findById(id: string): Promise<Role | null> {
    try {
      return await this.roleModel.findById({ _id: id }).exec();
    } catch (e) {
      return null;
    }
  }
}
