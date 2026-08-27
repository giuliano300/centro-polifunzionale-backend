import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsGateway } from 'src/controllers/notifications/notifications.gateway';
import { Notification, NotificationDocument } from 'src/schemas/notification.schema';
import { UserRole } from 'src/roles/user-role.enum';
import { PushSubscription } from 'src/schemas/push-subscription.schema';
import * as webpush from 'web-push';

export type CreateNotificationPayload = {
  audience: 'admin' | 'gestore' | 'cliente';
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
    @InjectModel(PushSubscription.name) private pushModel: Model<PushSubscription>,
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
      void this.sendPush(payload.userId, notification).catch(() => undefined);
    }

    return notification;
  }

  publicKey(): { publicKey: string } {
    return { publicKey: process.env.VAPID_PUBLIC_KEY || '' };
  }

  async sendPushNotification(userId: string, payload: { title: string; message: string; link?: string }): Promise<void> {
    try {
      await this.sendPush(userId, payload);
    } catch {
      // A push failure must never prevent a chat message from being sent.
    }
  }

  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.pushModel.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { user: new Types.ObjectId(userId), endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      { upsert: true, new: true },
    ).exec();
  }

  async unsubscribe(userId: string, endpoint: string): Promise<{ deleted: number }> {
    const result = await this.pushModel.deleteOne({ user: new Types.ObjectId(userId), endpoint }).exec();
    return { deleted: result.deletedCount || 0 };
  }

  private async sendPush(userId: string, notification: { title: string; message: string; link?: string }): Promise<void> {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:info@nagora.it', publicKey, privateKey);
    const subscriptions = await this.pushModel.find({ user: new Types.ObjectId(userId) }).exec();
    const payload = JSON.stringify({ notification: {
      title: notification.title,
      body: notification.message,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: notification.link || '/' },
    } });
    await Promise.all(subscriptions.map(async (item) => {
      try {
        await webpush.sendNotification({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }, payload);
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) await this.pushModel.deleteOne({ _id: item._id }).exec();
      }
    }));
  }

  emitAccountDisabled(userId: string): void {
    this.gateway.emitAccountDisabled(userId);
  }

  async findForUser(userId: string, role: UserRole): Promise<Notification[]> {
    await this.deleteOldReadNotifications();
    const query = role === UserRole.Admin
      ? { audience: 'admin' }
      : { audience: role === UserRole.Cliente ? 'cliente' : 'gestore', user: new Types.ObjectId(userId) };

    return this.notificationModel.find(query).sort({ createdAt: -1 }).limit(30).exec();
  }

  async unreadCount(userId: string, role: UserRole): Promise<{ count: number }> {
    const query = role === UserRole.Admin
      ? { audience: 'admin', isRead: false }
      : { audience: role === UserRole.Cliente ? 'cliente' : 'gestore', user: new Types.ObjectId(userId), isRead: false };

    const count = await this.notificationModel.countDocuments(query).exec();
    return { count };
  }

  async markRead(id: string, userId: string, role: UserRole): Promise<Notification | null> {
    const query = role === UserRole.Admin
      ? { _id: new Types.ObjectId(id), audience: 'admin' }
      : { _id: new Types.ObjectId(id), audience: role === UserRole.Cliente ? 'cliente' : 'gestore', user: new Types.ObjectId(userId) };

    return this.notificationModel.findOneAndUpdate(query, { isRead: true }, { new: true }).exec();
  }

  async markAllRead(userId: string, role: UserRole): Promise<{ updated: number }> {
    const query = role === UserRole.Admin
      ? { audience: 'admin', isRead: false }
      : { audience: role === UserRole.Cliente ? 'cliente' : 'gestore', user: new Types.ObjectId(userId), isRead: false };

    const result = await this.notificationModel.updateMany(query, { isRead: true }).exec();
    await this.deleteOldReadNotifications();
    return { updated: result.modifiedCount || 0 };
  }

  async deleteOldReadNotifications(): Promise<{ deleted: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await this.notificationModel.deleteMany({
      isRead: true,
      createdAt: { $lt: today },
    }).exec();
    return { deleted: result.deletedCount || 0 };
  }
}
