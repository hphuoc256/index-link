import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UserRepositoryInterface } from '../../repositories/user.interface.repository';
import { UserService } from '../user/user.service';
import { SinbyteRepositoryInterface } from '../../repositories/sinbyte.interface.repository';
import { paginationQuery } from '../../utils';
import { ROLE } from '../../common/enum';
import { ERROR_CODES } from '../../common/error-code';

@Injectable()
export class SinbyteService {
  constructor(
    @Inject('SinbyteRepositoryInterface')
    private readonly sinbyteRepo: SinbyteRepositoryInterface,
    @Inject('UserRepositoryInterface')
    private readonly userRepo: UserRepositoryInterface,
    private readonly userService: UserService,
  ) {}

  async findAll(req) {
    try {
      const { limit, skip } = paginationQuery(req.query);
      const sort = { _id: -1 };
      if (req.query.sort === 'ASC') sort._id = 1;

      let filter = {};

      const userLogin = await this.userService.findOne(req.user.sub);

      switch (userLogin.roleId['code']) {
        case ROLE.LEADER:
          filter = {
            leaderId: req.user.sub,
          };
      }

      if (req.query.search) {
        filter['$or'] = filter['$or'] || [];
        filter['$or'].push({
          name: new RegExp(req.query.search.toString(), 'i'),
        });
      }

      return await this.sinbyteRepo.findAll(filter, {
        limit,
        skip,
        sort,
      });
    } catch (e) {
      throw e;
    }
  }

  async create(sinbyteCreateDto, req) {
    try {
      const userLogin = await this.userService.findOne(req.user.sub);
      if (userLogin.roleId['code'] === ROLE.LEADER) {
        const checkExist = await this.sinbyteRepo.findOneByCondition({
          leaderId: req.user.sub,
        });
        if (checkExist) {
          throw new HttpException(
            ERROR_CODES.SINBYRE_EXIST,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        sinbyteCreateDto.leaderId = req.user.sub;
      } else {
        const populateConfig = [
          { path: 'roleId', select: 'name code description' },
        ];
        const leader = await this.userRepo.findByIdWithSubFields(
          sinbyteCreateDto.leaderId,
          {
            populate: populateConfig,
          },
        );
        if (!leader) {
          throw new HttpException(
            ERROR_CODES.LEADER_NOT_FOUND,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        if (leader.roleId['code'] !== ROLE.LEADER) {
          throw new HttpException(
            ERROR_CODES.USER_NOT_LEADER,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        const checkExist = await this.sinbyteRepo.findOneByCondition({
          leaderId: sinbyteCreateDto.leaderId,
        });
        if (checkExist) {
          throw new HttpException(
            ERROR_CODES.SINBYRE_EXIST,
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }

      return await this.sinbyteRepo.create(sinbyteCreateDto);
    } catch (e) {
      throw e;
    }
  }

  async update(id, sinbyteUpdateDto, req) {
    try {
      const userLogin = await this.userService.findOne(req.user.sub);
      const sinbyteDetail = await this.sinbyteRepo.findOneById(id);
      switch (userLogin.roleId['code']) {
        case ROLE.LEADER:
          const sinbyteByIdLeaderId = await this.sinbyteRepo.findOneByCondition(
            {
              leaderId: req.user.sub,
              _id: id,
            },
          );
          if (!sinbyteByIdLeaderId) {
            throw new HttpException(
              ERROR_CODES.SINBYTE_IS_NOT_ALLOW_UPDATE,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          sinbyteUpdateDto.leaderId = req.user.sub;
          break;
        default:
          if (!sinbyteDetail) {
            throw new HttpException(
              ERROR_CODES.SINBYTE_IS_NOT_ALLOW_UPDATE,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          const populateConfig = [
            { path: 'roleId', select: 'name code description' },
          ];
          const leader = await this.userRepo.findByIdWithSubFields(
            sinbyteUpdateDto.leaderId,
            {
              populate: populateConfig,
            },
          );
          if (!leader) {
            throw new HttpException(
              ERROR_CODES.LEADER_NOT_FOUND,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
          if (leader.roleId['code'] !== ROLE.LEADER) {
            throw new HttpException(
              ERROR_CODES.USER_NOT_LEADER,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
          }
      }
      return await this.sinbyteRepo.update(id, sinbyteUpdateDto);
    } catch (e) {
      throw e;
    }
  }

  async findById(id, req) {
    try {
      let result: any;
      const userLogin = await this.userService.findOne(req.user.sub);
      switch (userLogin.roleId['code']) {
        case ROLE.LEADER:
          result = await this.sinbyteRepo.findOneByCondition({
            leaderId: req.user.sub,
            _id: id,
          });
          if (!result)
            throw new HttpException(
              ERROR_CODES.SINBYTE_NOT_EXITS,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
        case ROLE.ADMIN:
          result = await this.sinbyteRepo.findOneByCondition({ _id: id });
          if (!result)
            throw new HttpException(
              ERROR_CODES.SINBYTE_NOT_EXITS,
              HttpStatus.UNPROCESSABLE_ENTITY,
            );
      }
      return result;
    } catch (e) {
      throw e;
    }
  }

  async delete(id, req) {
    try {
      const auth = await this.userRepo.findByIdWithSubFields(req.user.sub, {
        populate: [{ path: 'roleId', select: 'name code description' }],
      });

      const filter = {
        _id: id,
      };
      if (auth.roleId['code'] !== ROLE.ADMIN) filter['leaderId'] = req.user.sub;
      const sinbyteDetail = await this.sinbyteRepo.findOneByCondition({
        ...filter,
      });
      if (!sinbyteDetail) {
        throw new HttpException(
          ERROR_CODES.SINBYTE_NOT_EXITS,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      return await this.sinbyteRepo.softDelete(id);
    } catch (e) {
      throw e;
    }
  }
}
