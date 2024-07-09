import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { HashService } from '../../services/hash.service';
import { UserRepositoryInterface } from '../../repositories/user.interface.repository';
import { RoleRepositoryInterface } from '../../repositories/role.interface.repository';
import { AuthChangePassDto } from './dto/auth-change-pass.dto';
import { AuthJwtWithUser, SignPayload } from '../../types/global';
import { ERROR_CODES } from '../../common/error-code';
import { AuthUpdateDto } from './dto/auth-update.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private hashService: HashService,
    @Inject('UserRepositoryInterface')
    private readonly userRepo: UserRepositoryInterface,
    @Inject('RoleRepositoryInterface')
    private readonly roleRepo: RoleRepositoryInterface,
  ) {}

  async login(payload): Promise<AuthJwtWithUser | any> {
    try {
      const user = await this.userService.findByEmail(payload.email, true);
      if (!user) {
        throw new HttpException(
          ERROR_CODES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      const checkPassword = await this.hashService.checkPassword(
        payload.password,
        user.password,
      );
      if (!checkPassword) {
        throw new HttpException(
          ERROR_CODES.PASSWORD_INCORRECT,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const token = await this.getToken({
        sub: user._id,
        email: user.email,
      });

      await this.userRepo.updateRefreshToken({
        id: user._id,
        refreshToken: token.refreshToken,
      });

      delete user.password;
      return { token, user };
    } catch (e) {
      throw e;
    }
  }

  async getToken(payload: any): Promise<SignPayload> {
    const [accessToken, refreshToken] = await Promise.all([
      this.createToken(payload),
      this.createRefresh(payload),
    ]);
    return {
      type: 'Bearer',
      accessToken,
      refreshToken,
    };
  }

  async createToken(payload: any) {
    const { SECRET_KEY, EXPIRES_IN } = process.env;
    return await this.jwtService.signAsync(payload, {
      secret: SECRET_KEY,
      expiresIn: EXPIRES_IN,
    });
  }

  async createRefresh(payload) {
    const { REFRESH_SECRET_KEY, REFRESH_EXPIRES_IN } = process.env;
    return await this.jwtService.signAsync(payload, {
      secret: REFRESH_SECRET_KEY,
      expiresIn: REFRESH_EXPIRES_IN,
    });
  }

  async refresh({ refreshToken, userId }): Promise<SignPayload> {
    try {
      const { REFRESH_SECRET_KEY } = process.env;

      const user = await this.userRepo.findOneWithRefreshToken(userId);

      if (!user || !user?.refreshToken) {
        throw new HttpException(
          ERROR_CODES.UNAUTHORIZED,
          HttpStatus.UNAUTHORIZED,
        );
      }

      const verify = await this.jwtService.verifyAsync(refreshToken, {
        secret: REFRESH_SECRET_KEY,
      });
      if (!verify) {
        throw new HttpException(
          ERROR_CODES.ACCESS_DENIED,
          HttpStatus.BAD_REQUEST,
        );
      }

      const token = await this.getToken({
        sub: user._id,
        email: user.email,
      });

      await this.userRepo.updateRefreshToken({
        id: user._id,
        refreshToken: token.refreshToken,
      });

      return token;
    } catch (e) {
      throw e;
    }
  }

  async changePassword(id, payload: AuthChangePassDto) {
    try {
      const user = await this.userRepo.findWithPasswordById({ id });
      if (!user) {
        throw new HttpException(
          ERROR_CODES.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND,
        );
      }

      const verify = await this.hashService.checkPassword(
        payload.oldPassword,
        user.password,
      );
      if (!verify) {
        throw new HttpException(
          ERROR_CODES.OLD_PASSWORD_INCORRECT,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const password = await this.hashService.hashPassword(payload.password);

      return await this.userRepo.update(id, {
        password,
      });
    } catch (e) {
      throw e;
    }
  }

  async update(req, authUpdateDto: AuthUpdateDto) {
    try {
      const id = req.user.sub;
      return await this.userRepo.update(id, authUpdateDto);
    } catch (e) {
      throw e;
    }
  }
}
