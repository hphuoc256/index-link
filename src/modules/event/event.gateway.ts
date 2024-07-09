import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsGuard } from '../../middlewares/ws.guard.middleware';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventGateway {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  @WebSocketServer()
  server: Server;

  @UseGuards(WsGuard)
  sendStatusUpdate(@MessageBody() data) {
    this.server.emit('updateStatusLink', data as any);
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('login-success')
  async handleLogin(socket: Socket) {
    let token = socket.handshake.headers.authorization;
    token = token.split(' ')[1];
    const { SECRET_KEY } = process.env;
    const decoded = await this.jwtService.verifyAsync(token, {
      secret: SECRET_KEY,
    });
    const user: any = await this.userService.findById(decoded.sub);
    this.server.emit('loginSuccess', user);
  }
}
