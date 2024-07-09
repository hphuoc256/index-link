import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthLoginDto } from './dto/auth-login.dto';
import { UserService } from '../user/user.service';
import { HashService } from '../../services/hash.service';
import { AuthRefreshTokenDto } from './dto/auth-refresh-token.dto';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../middlewares/authguard.middleware';
import { AuthChangePassDto } from './dto/auth-change-pass.dto';
import { MyLoggerService } from '../logger/logger.service';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { fullPath } from '../../utils/route';

@ApiHeader({
  name: 'request-id',
  description: 'Fingerprint',
})
@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly hashService: HashService,
    private logger: MyLoggerService,
  ) {
    this.logger.setContext('AuthController');
  }

  @Post('login')
  async login(
    @Body() body: AuthLoginDto,
    @Res() res,
    @Req() req,
  ): Promise<void> {
    try {
      const result = await this.authService.login(body);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @Post('refresh')
  async refresh(
    @Res() res,
    @Req() req,
    @Body() authRefreshTokenDto: AuthRefreshTokenDto,
  ) {
    try {
      const { refreshToken, userId } = authRefreshTokenDto;
      const result = await this.authService.refresh({
        refreshToken,
        userId,
      });
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result, null);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Res() res, @Req() req) {
    try {
      const id = req.user.sub;
      const result = await this.userService.findOne(id);
      this.logger.log(JSON.stringify(result), fullPath(req));
      res.locals.standardResponse(result);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async changePassword(
    @Res() res,
    @Body() authChangePassDto: AuthChangePassDto,
    @Req() req,
  ) {
    try {
      const id = req.user.sub;
      await this.authService.changePassword(id, authChangePassDto);
      this.logger.log(JSON.stringify(''), fullPath(req));
      res.locals.standardResponse([]);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }

  @Put('update')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async update(@Res() res, @Body() authUpdateDto: AuthUpdateDto, @Req() req) {
    try {
      const user = await this.authService.update(req, authUpdateDto);
      this.logger.log(JSON.stringify(''), fullPath(req));
      res.locals.standardResponse(user);
    } catch (e) {
      this.logger.error(fullPath(req), e);
      res.locals.standardResponse(null, e);
    }
  }
}
