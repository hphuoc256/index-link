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
import { SinbyteService } from './sinbyte.service';
import { PermissionGuard } from '../../middlewares/permission.guard.middleware';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { Roles } from '../../decorators/role.decorator';
import { CreateSinbyteDto } from './dto/create-sinbyte.dto';
import { UpdateSinbyteDto } from './dto/update-sinbyte.dto';
import { fullPath } from '../../utils/route';

@ApiBearerAuth()
@Controller('sinbyte')
@ApiTags('Sinbyte')
export class SinbyteController {
  constructor(
    private readonly sinbyteService: SinbyteService,
    private readonly logger: MyLoggerService,
  ) {
    this.logger.setContext('SinbyteController');
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin | leader',
    description: 'Endpoint get all sinbyte',
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
      const data = await this.sinbyteService.findAll(req);
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
    description: 'Endpoint create sinbyte',
  })
  @Post()
  async create(
    @Res() res,
    @Req() req,
    @Body() createSinbyteDto: CreateSinbyteDto,
  ) {
    try {
      const sinbyte = await this.sinbyteService.create(createSinbyteDto, req);
      this.logger.log(JSON.stringify(sinbyte), fullPath(req));
      return res.locals.standardResponse(sinbyte);
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
    description: 'Endpoint update sinbyte',
  })
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateSinbyteDto: UpdateSinbyteDto,
    @Res() res,
    @Req() req,
  ) {
    try {
      const result = await this.sinbyteService.update(
        id,
        updateSinbyteDto,
        req,
      );
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error('SinbyteController/UpdateFail', e);
      res.locals.standardResponse(null, e);
    }
  }

  @UseGuards(PermissionGuard)
  @UseGuards(AuthGuard)
  @Roles('admin', 'leader')
  @ApiOperation({
    summary: 'admin | leader',
    description: 'Endpoint get detail sinbyte',
  })
  @Get('/:id')
  async findOne(@Res() res, @Req() req, @Param('id') id: string) {
    try {
      const result = await this.sinbyteService.findById(id, req);
      this.logger.log(JSON.stringify(result), fullPath(req));
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
    description: 'Endpoint delete sinbyte',
  })
  @Delete(':id')
  async delete(@Param('id') id: string, @Res() res, @Req() req) {
    try {
      const result = await this.sinbyteService.delete(id, req);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
}
