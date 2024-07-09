import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserService } from '../modules/user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { Request } from 'express';

@Injectable()
export class WsGuard implements CanActivate {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: any): Promise<boolean | any> {
    const bearerToken =
      context.args[0].handshake.headers.authorization.split(' ')[1];
    if (!bearerToken) {
      return false;
    }
    const client: Socket = context.switchToWs().getClient();
    try {
      const { SECRET_KEY } = process.env;
      const decoded = await this.jwtService.verifyAsync(bearerToken, {
        secret: SECRET_KEY,
      });
      const user = await this.userService.findById(decoded.sub);
      if (!user) return false;
      //
      // if (['leader, user'].includes(user.roleId['code'])) {
      //   client.join(`room_`);
      // }
      context.switchToWs().getData().user = user;
      return true;
    } catch (err) {
      return false;
    }
  }

  private static extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
