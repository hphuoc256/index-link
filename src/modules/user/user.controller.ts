import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { MyLoggerService } from '../logger/logger.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../decorators/role.decorator';
import { PermissionGuard } from '../../middlewares/permission.guard.middleware';
import { ROLE } from '../../common/enum';
import { fullPath } from '../../utils/route';

@ApiBearerAuth()
@Controller('user')
@ApiTags('User')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('UserController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin | leader',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'name | email',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'ASC | DESC',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ROLE,
    description: 'admin | user | leader',
  })
  @ApiQuery({
    name: 'leaderId',
    required: false,
    type: String,
    description: 'Only role Admin',
  })
  @Get()
  async findAll(@Req() req, @Res() res) {
    try {
      const users = await this.userService.findAll(req);
      this.logger.log(JSON.stringify(users), fullPath(req));
      return res.locals.standardResponse(users);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin | leader',
  })
  @Post()
  async create(@Res() res, @Req() req, @Body() userCreate: CreateUserDto) {
    try {
      const user = await this.userService.create(userCreate, req);
      this.logger.log(JSON.stringify(user), fullPath(req));
      return res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin | leader',
  })
  @Get(':id')
  async findById(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const user = await this.userService.findOne(id);
      this.logger.log(JSON.stringify(user), fullPath(req));
      res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin | leader',
  })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Res() res,
    @Req() req,
  ) {
    try {
      const result = await this.userService.update(id, updateUserDto, req);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin | leader',
  })
  @Delete(':id')
  async delete(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const result = await this.userService.delete(id, req);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
}
