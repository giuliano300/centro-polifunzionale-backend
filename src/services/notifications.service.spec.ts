import { Types } from 'mongoose';
import { UserRole } from 'src/roles/user-role.enum';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const notificationModel = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  const gateway = {
    emitToAdmin: jest.fn(),
    emitToUser: jest.fn(),
    emitAccountDisabled: jest.fn(),
  };

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationModel.deleteMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    });
    service = new NotificationsService(notificationModel as any, gateway as any);
  });

  it('emits admin notifications to the admin room', async () => {
    const notification = { _id: new Types.ObjectId(), title: 'Nuovo acquisto spazio' };
    notificationModel.create.mockResolvedValue(notification);

    await service.create({
      audience: 'admin',
      title: 'Nuovo acquisto spazio',
      message: 'Mario Rossi ha acquistato Sala Yoga.',
      type: 'booking_created',
      link: '/bookings',
    });

    expect(gateway.emitToAdmin).toHaveBeenCalledWith(notification);
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('marks all unread notifications for a manager as read', async () => {
    notificationModel.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
    });

    const userId = new Types.ObjectId().toString();

    await expect(service.markAllRead(userId, UserRole.Gestore)).resolves.toEqual({ updated: 3 });
    expect(notificationModel.updateMany).toHaveBeenCalledWith(
      { audience: 'gestore', user: new Types.ObjectId(userId), isRead: false },
      { isRead: true },
    );
  });

  it('loads client notifications from the client audience', async () => {
    const limit = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) });
    const sort = jest.fn().mockReturnValue({ limit });
    notificationModel.find.mockReturnValue({ sort });
    const userId = new Types.ObjectId().toString();

    await service.findForUser(userId, UserRole.Cliente);

    expect(notificationModel.find).toHaveBeenCalledWith({
      audience: 'cliente',
      user: new Types.ObjectId(userId),
    });
  });

  it('orders user notifications from newest to oldest', async () => {
    const sort = jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) });
    notificationModel.find.mockReturnValue({ sort });

    await service.findForUser(new Types.ObjectId().toString(), UserRole.Admin);

    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
