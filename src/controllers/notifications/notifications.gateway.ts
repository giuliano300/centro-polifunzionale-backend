import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserRole } from 'src/roles/user-role.enum';

type SocketUser = {
  sub?: string;
  userId?: string;
  email?: string;
  role?: UserRole;
};

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:4300', 'http://localhost:4400'],
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.query?.token;
    if (!token || Array.isArray(token)) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<SocketUser>(token, {
        secret: process.env.JWT_SECRET || 'a-string-secret-at-least-256-bits-long',
      });
      const userId = payload.sub || payload.userId;
      if (!userId || !payload.role) {
        client.disconnect();
        return;
      }

      client.join(`user:${userId}`);
      client.join(`role:${payload.role}`);
    } catch {
      client.disconnect();
    }
  }

  emitToAdmin(notification: unknown): void {
    this.server?.to(`role:${UserRole.Admin}`).emit('notification', notification);
  }

  emitToUser(userId: string, notification: unknown): void {
    this.server?.to(`user:${userId}`).emit('notification', notification);
  }
}
