import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MyLoggerService } from '../logger/logger.service';
import { ConfigService } from './config.service';
import { PermissionGuard } from '../../middlewares/permission.guard.middleware';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { Roles } from '../../decorators/role.decorator';
import { CreateConfigDto } from './dto/create-config.dto';
import { fullPath } from '../../utils/route';

@ApiBearerAuth()
@Controller('config')
@ApiTags('CheckLink')
export class ConfigController {
  constructor(
    private readonly configService: ConfigService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('ConfigController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'admin', 'leader')
  @ApiOperation({
    summary: 'user | admin | leader',
    description: 'Endpoint create config',
  })
  @Post('check-link')
  async create(@Res() res, @Req() req, @Body() configCreate: CreateConfigDto) {
    try {
      const user = await this.configService.checkLink(configCreate, req);
      this.logger.log(JSON.stringify(user), fullPath(req));
      return res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'admin', 'leader')
  @ApiOperation({
    summary: 'user | admin | leader',
    description: 'Endpoint create config',
  })
  @Post('check-link-index')
  async checkLinkIndex(
    @Res() res,
    @Req() req,
    @Body() configCreate: CreateConfigDto,
  ) {
    try {
      const user = await this.configService.checkLinkIndex(configCreate, req);
      this.logger.log(JSON.stringify(user), fullPath(req));
      return res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('user', 'admin', 'leader')
  @ApiOperation({
    summary: 'user | admin | leader',
    description: 'Endpoint create config',
  })
  @Post('indexed')
  async indexed(@Res() res, @Req() req, @Body() configCreate: CreateConfigDto) {
    try {
      const user = await this.configService.indexed(configCreate, req);
      this.logger.log(JSON.stringify(user), fullPath(req));
      return res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      return res.locals.standardResponse(null, e);
    }
  }
}
