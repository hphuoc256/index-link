import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { MyLoggerService } from '../logger/logger.service';
import { HistoryService } from './history.service';
import { PermissionGuard } from '../../middlewares/permission.guard.middleware';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { Roles } from '../../decorators/role.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { STATUS_LINK } from '../../common/enum';
import { fullPath } from '../../utils/route';

@ApiBearerAuth()
@ApiTags('History')
@Controller('history')
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('HistoryController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader', 'user')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'telegram',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: STATUS_LINK,
    description: 'status',
  })
  @ApiQuery({
    name: 'suggestId',
    required: false,
    type: String,
    description: '',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    type: String,
    description: 'ASC | DESC',
  })
  @Get()
  async findAll(@Req() req, @Res() res) {
    try {
      const histories = await this.historyService.findAll(req);
      this.logger.log(JSON.stringify(histories), fullPath(req));
      return res.locals.standardResponse(histories);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader', 'user')
  @ApiOperation({
    summary: 'admin | leader | user',
  })
  @Get(':id')
  async findById(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const history = await this.historyService.findOne(id);
      this.logger.log(JSON.stringify(history), fullPath(req));
      res.locals.standardResponse(history);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
}
