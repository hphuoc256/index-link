import { Inject, Injectable } from '@nestjs/common';
import { RoleRepositoryInterface } from '../../repositories/role.interface.repository';
import { CreateRoleDto } from './dto/create-role.dto';
import { Role } from '../../entities/role.entity';
import { paginationQuery } from '../../utils';

@Injectable()
export class RoleService {
  constructor(
    @Inject('RoleRepositoryInterface')
    private readonly roleRepo: RoleRepositoryInterface,
  ) {}

  async findAll(req) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;

      const filter = {};
      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          name: new RegExp(req.query.search.toString(), 'i'),
          code: new RegExp(req.query.search.toString(), 'i'),
          description: new RegExp(req.query.search.toString(), 'i'),
        });
      }

      return await this.roleRepo.findAll(filter, {
        limit,
        skip,
        sort,
      });
    } catch (e) {
      throw e;
    }
  }

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    try {
      return await this.roleRepo.create(createRoleDto);
    } catch (e) {
      throw e;
    }
  }

  async update(id, data): Promise<Role> {
    try {
      return await this.roleRepo.update(id, data);
    } catch (e) {
      throw e;
    }
  }

  async findById(id): Promise<Role> {
    try {
      return await this.roleRepo.findById(id);
    } catch (e) {
      throw e;
    }
  }
}
