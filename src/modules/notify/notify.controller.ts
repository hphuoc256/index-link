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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MyLoggerService } from '../logger/logger.service';
import { NotifyService } from './notify.service';
import { PermissionGuard } from '../../middlewares/permission.guard.middleware';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { Roles } from '../../decorators/role.decorator';
import { fullPath } from '../../utils/route';

@ApiBearerAuth()
@ApiTags('Notify')
@Controller('notify')
export class NotifyController {
  constructor(
    private readonly notifyService: NotifyService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('ConfigController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'admin', 'leader')
  @ApiOperation({
    summary: 'user | admin | leader',
  })
  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'title',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'ASC | DESC',
  })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Number,
    description: '0: UnRead | 1: Read',
  })
  async findAll(@Req() req, @Res() res) {
    try {
      const data = await this.notifyService.findAll(req);
      this.logger.log(JSON.stringify(data), fullPath(req));
      return res.locals.standardResponse(data);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @Get('/:id')
  async findOne(@Res() res, @Param('id') id: string, @Req() req) {
    try {
      const user = await this.notifyService.findOne(id);
      this.logger.log(JSON.stringify(user), fullPath(req));
      return res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Read Notify',
  })
  @Post('/read/:id')
  async update(@Res() res, @Req() req, @Param('id') id: string) {
    try {
      const user = await this.notifyService.update(id, req);
      this.logger.log(JSON.stringify(user), fullPath(req));
      return res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Endpoint delete notify',
  })
  @Delete(':id')
  async delete(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const result = await this.notifyService.delete(id, req);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'leader', 'admin')
  @ApiOperation({
    summary: 'admin | leader | user',
    description: 'Read Notifys',
  })
  @Put('/reads')
  async updateMany(@Res() res, @Req() req) {
    try {
      const noti = await this.notifyService.updateNotiToRead();
      this.logger.log(JSON.stringify(noti), fullPath(req));
      return res.locals.standardResponse(noti);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }
}
