import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RoleService } from './role.service';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { UpdateRoleDto } from './dto/update-role.dto';
import { MyLoggerService } from '../logger/logger.service';
import { PermissionGuard } from '../../middlewares/permission.guard.middleware';
import { ERROR_CODES } from '../../common/error-code';
import { Roles } from '../../decorators/role.decorator';
import { fullPath } from '../../utils/route';

@ApiBearerAuth()
@ApiTags('Role')
@Controller('role')
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('RoleController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'admin',
  })
  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'name',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'ASC | DESC',
  })
  async findAll(@Req() req, @Res() res) {
    try {
      const data = await this.roleService.findAll(req);
      this.logger.log(JSON.stringify(data), fullPath(req));
      return res.locals.standardResponse(data);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  /*@UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'admin',
    description: 'Endpoint create role',
  })
  @Post()
  async create(@Res() res, @Body() createRoleDto: CreateRoleDto) {
    try {
      const data = await this.roleService.create(createRoleDto);
      this.logger.log(JSON.stringify(data), 'RoleController/CreateSuccess');
      return res.locals.standardResponse(data);
    } catch (e) {
      this.logger.error('RoleController/CreateFail', e);
      res.locals.standardResponse(null, e);
    }
  }*/

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'admin',
  })
  @Get(':id')
  async findById(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const data = await this.roleService.findById(id);
      if (!data) {
        throw new HttpException(
          ERROR_CODES.ROLE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      this.logger.log(JSON.stringify(data), fullPath(req));
      return res.locals.standardResponse(data);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'admin',
    description: 'Endpoint update role',
  })
  @Put(':id')
  async update(
    @Res() res,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() req,
  ) {
    try {
      const role = await this.roleService.update(id, updateRoleDto);
      if (!role) {
        throw new HttpException(
          ERROR_CODES.ROLE_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }
      this.logger.log(JSON.stringify(role), fullPath(req));
      return res.locals.standardResponse(role);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
}
