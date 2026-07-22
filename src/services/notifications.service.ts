import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsGateway } from 'src/controllers/notifications/notifications.gateway';
import { Notification, NotificationDocument } from 'src/schemas/notification.schema';
import { UserRole } from 'src/roles/user-role.enum';

export type CreateNotificationPayload = {
  audience: 'admin' | 'gestore';
  userId?: string;
  title: string;
  message: string;
  type: string;
  link?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private gateway: NotificationsGateway,
  ) {}

  async create(payload: CreateNotificationPayload): Promise<Notification> {
    const notification = await this.notificationModel.create({
      audience: payload.audience,
      user: payload.userId ? new Types.ObjectId(payload.userId) : undefined,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link,
    });

    if (payload.audience === 'admin') {
      this.gateway.emitToAdmin(notification);
    } else if (payload.userId) {
      this.gateway.emitToUser(payload.userId, notification);
    }

    return notification;
  }

  async findForUser(userId: string, role: UserRole): Promise<Notification[]> {
    const query = role === UserRole.Admin
      ? { audience: 'admin' }
      : { audience: 'gestore', user: new Types.ObjectId(userId) };

    return this.notificationModel.find(query).sort({ createdAt: -1 }).limit(30).exec();
  }

  async unreadCount(userId: string, role: UserRole): Promise<{ count: number }> {
    const query = role === UserRole.Admin
      ? { audience: 'admin', isRead: false }
      : { audience: 'gestore', user: new Types.ObjectId(userId), isRead: false };

    const count = await this.notificationModel.countDocuments(query).exec();
    return { count };
  }

  async markRead(id: string, userId: string, role: UserRole): Promise<Notification | null> {
    const query = role === UserRole.Admin
      ? { _id: new Types.ObjectId(id), audience: 'admin' }
      : { _id: new Types.ObjectId(id), audience: 'gestore', user: new Types.ObjectId(userId) };

    return this.notificationModel.findOneAndUpdate(query, { isRead: true }, { new: true }).exec();
  }

  async markAllRead(userId: string, role: UserRole): Promise<{ updated: number }> {
    const query = role === UserRole.Admin
      ? { audience: 'admin', isRead: false }
      : { audience: 'gestore', user: new Types.ObjectId(userId), isRead: false };

    const result = await this.notificationModel.updateMany(query, { isRead: true }).exec();
    return { updated: result.modifiedCount || 0 };
  }
}
