import { BaseRepositoryInterface } from './base/base.interface.repository';
import { Role } from '../entities/role.entity';

export interface RoleRepositoryInterface extends BaseRepositoryInterface<Role> {
  findById(id: string): Promise<Role | null>;
}
