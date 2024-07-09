import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserService } from '../modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { CustomPermissionException } from '../pipes/custom-permission.pipe';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userService: UserService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const { SECRET_KEY } = process.env;
      const roles = this.reflector.get<string[]>('roles', context.getHandler());
      const request = context.switchToHttp().getRequest();

      const [type, token] = request.headers.authorization?.split(' ') ?? [];
      const payload = await this.jwtService.verifyAsync(token, {
        secret: SECRET_KEY,
      });

      const { user, role } = await this.userService.getWithRoleById({
        id: payload?.sub,
      });

      if (
        user &&
        user.email === (process.env.SUPER_ADMIN || 'superadmin@gmail.com')
      ) {
        return true;
      }

      if (!payload || !role) {
        throw new CustomPermissionException();
      }

      // Check role user
      if (roles && roles.length) {
        const hasRequiredRole = roles.includes(role.code);
        if (!hasRequiredRole) {
          throw new CustomPermissionException();
        }
      }
      return true;
    } catch (e) {
      throw new CustomPermissionException();
    }
  }
}
