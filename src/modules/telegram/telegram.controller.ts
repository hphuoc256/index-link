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
import { TelegramService } from './telegram.service';
import { MyLoggerService } from '../logger/logger.service';
import { PermissionGuard } from '../../middlewares/permission.guard.middleware';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { Roles } from '../../decorators/role.decorator';
import { TelegramConfigCreateDto } from './dto/create-telegram.dto';
import { TelegramConfigUpdateDto } from './dto/update-telegram.dto';
import { fullPath } from '../../utils/route';

@ApiBearerAuth()
@Controller('telegram')
@ApiTags('Telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly logger: MyLoggerService,
  ) {
    this.logger.setContext('TelegramController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin | leader',
    description: 'Endpoint get all telegramconfig',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'title',
  })
  @Get()
  async findAll(@Req() req, @Res() res) {
    try {
      const data = await this.telegramService.findAll(req);
      this.logger.log(JSON.stringify(data), fullPath(req));
      return res.locals.standardResponse(data);
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
    description: 'Endpoint create telegram config',
  })
  @Post()
  async create(
    @Res() res,
    @Req() req,
    @Body() telegramConfigCreateDto: TelegramConfigCreateDto,
  ) {
    try {
      const telegramConfig = await this.telegramService.create(
        telegramConfigCreateDto,
        req,
      );
      this.logger.log(JSON.stringify(telegramConfig), fullPath(req));
      return res.locals.standardResponse(telegramConfig);
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
    description: 'Endpoint update telegram config',
  })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() telegramConfigUpdateDto: TelegramConfigUpdateDto,
    @Res() res,
    @Req() req,
  ) {
    try {
      const result = await this.telegramService.update(
        id,
        telegramConfigUpdateDto,
        req,
      );
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
    description: 'Endpoint get detail telegramconfig',
  })
  @Get('/:id')
  async findOne(@Res() res, @Req() req, @Param('id') id: string) {
    try {
      const result = await this.telegramService.findById(id, req);
      this.logger.log(
        JSON.stringify(result),
        'TelegramConfigController/GetDetailSuccess',
      );
      return res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin',
    description: 'Endpoint delete telegramconfig',
  })
  @Delete(':id')
  async delete(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const result = await this.telegramService.delete(id, req);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
}
