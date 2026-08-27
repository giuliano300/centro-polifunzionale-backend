import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserRole } from 'src/roles/user-role.enum';
import { User, UserDocument } from 'src/schemas/user.schema';
import { WalletMovement, WalletMovementDocument } from 'src/schemas/wallet-movement.schema';
import { NotificationsService } from './notifications.service';

@Injectable()
export class WalletService {
  private readonly userWalletQueues = new Map<string, Promise<void>>();

  constructor(
    @InjectModel(WalletMovement.name) private walletMovementModel: Model<WalletMovementDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
  ) {}

  async withUserWalletLock<T>(userId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.userWalletQueues.get(userId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.userWalletQueues.set(userId, queued);

    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.userWalletQueues.get(userId) === queued) {
        this.userWalletQueues.delete(userId);
      }
    }
  }

  async creditCancellationRefund(userId: string, bookingId: string, amount: number, description?: string): Promise<WalletMovement | null> {
    if (amount <= 0) {
      return null;
    }

    const existing = await this.walletMovementModel.findOne({
      user: new Types.ObjectId(userId),
      booking: new Types.ObjectId(bookingId),
      reason: 'cancellation_refund',
      type: 'credit',
    }).exec();

    if (existing) {
      existing.amount = amount;
      existing.description = description;
      const saved = await existing.save();
      await this.notifyWalletCredit(userId, amount);
      return saved;
    }

    const movement = await this.walletMovementModel.create({
      user: new Types.ObjectId(userId),
      booking: new Types.ObjectId(bookingId),
      type: 'credit',
      reason: 'cancellation_refund',
      amount,
      currency: 'EUR',
      description,
    });
    await this.notifyWalletCredit(userId, amount);
    return movement;
  }

  async creditSignupBonus(userId: string, amount: number, description?: string): Promise<WalletMovement | null> {
    if (amount <= 0) {
      return null;
    }

    const existing = await this.walletMovementModel.findOne({
      user: new Types.ObjectId(userId),
      reason: 'signup_bonus',
      type: 'credit',
    }).exec();

    if (existing) {
      return existing;
    }

    return this.walletMovementModel.create({
      user: new Types.ObjectId(userId),
      type: 'credit',
      reason: 'signup_bonus',
      amount,
      currency: 'EUR',
      description,
    });
  }

  async creditManual(userId: string, amount: number, description?: string): Promise<WalletMovement> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Utente non valido');
    }

    const creditAmount = Number(amount || 0);
    if (creditAmount <= 0) {
      throw new BadRequestException('Il credito wallet deve essere maggiore di zero');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    if (user.role === UserRole.Admin) {
      throw new BadRequestException('Il credito wallet non è disponibile per gli amministratori');
    }

    const movement = await this.walletMovementModel.create({
      user: new Types.ObjectId(userId),
      type: 'credit',
      reason: 'manual',
      amount: creditAmount,
      currency: 'EUR',
      description: description || 'Credito una tantum inserito dal backoffice',
    });

    await this.notifyWalletCredit(
      userId,
      creditAmount,
      user.role === UserRole.Cliente ? 'cliente' : 'gestore',
      'Credito wallet accreditato',
    );
    return movement;
  }

  async debitBookingPayment(userId: string, bookingId: string, amount: number, description?: string): Promise<WalletMovement | null> {
    if (amount <= 0) {
      return null;
    }

    const existing = await this.walletMovementModel.findOne({
      user: new Types.ObjectId(userId),
      booking: new Types.ObjectId(bookingId),
      reason: 'booking_payment',
      type: 'debit',
    }).exec();

    if (existing) {
      return existing;
    }

    const availableBalance = await this.balance(userId);
    if (amount > availableBalance) {
      throw new BadRequestException('Credito wallet insufficiente');
    }

    return this.walletMovementModel.create({
      user: new Types.ObjectId(userId),
      booking: new Types.ObjectId(bookingId),
      type: 'debit',
      reason: 'booking_payment',
      amount,
      currency: 'EUR',
      description,
    });
  }

  async debitCoursePayment(userId: string, courseBookingId: string, amount: number, description?: string): Promise<WalletMovement | null> {
    if (amount <= 0) {
      return null;
    }

    const existing = await this.walletMovementModel.findOne({
      user: new Types.ObjectId(userId),
      courseBooking: new Types.ObjectId(courseBookingId),
      reason: 'course_payment',
      type: 'debit',
    }).exec();

    if (existing) {
      return existing;
    }

    const availableBalance = await this.balance(userId);
    if (amount > availableBalance) {
      throw new BadRequestException('Credito wallet insufficiente');
    }

    return this.walletMovementModel.create({
      user: new Types.ObjectId(userId),
      courseBooking: new Types.ObjectId(courseBookingId),
      type: 'debit',
      reason: 'course_payment',
      amount,
      currency: 'EUR',
      description,
    });
  }

  async releaseBookingHold(userId: string, bookingId: string, amount: number): Promise<WalletMovement | null> {
    if (amount <= 0) return null;
    const query = {
      user: new Types.ObjectId(userId), booking: new Types.ObjectId(bookingId),
      reason: 'booking_hold_release', type: 'credit',
    };
    const existing = await this.walletMovementModel.findOne(query).exec();
    if (existing) return existing;
    return this.walletMovementModel.create({ ...query, amount, currency: 'EUR', description: 'Rilascio prenotazione scaduta' });
  }

  async releaseCourseHold(userId: string, courseBookingId: string, amount: number): Promise<WalletMovement | null> {
    if (amount <= 0) return null;
    const query = {
      user: new Types.ObjectId(userId), courseBooking: new Types.ObjectId(courseBookingId),
      reason: 'course_hold_release', type: 'credit',
    };
    const existing = await this.walletMovementModel.findOne(query).exec();
    if (existing) return existing;
    return this.walletMovementModel.create({ ...query, amount, currency: 'EUR', description: 'Rilascio iscrizione scaduta' });
  }

  async creditCourseRefund(userId: string, courseBookingId: string, amount: number, description?: string): Promise<WalletMovement | null> {
    if (amount <= 0) {
      return null;
    }

    const existing = await this.walletMovementModel.findOne({
      user: new Types.ObjectId(userId),
      courseBooking: new Types.ObjectId(courseBookingId),
      reason: 'course_refund',
      type: 'credit',
    }).exec();

    if (existing) {
      return existing;
    }

    const movement = await this.walletMovementModel.create({
      user: new Types.ObjectId(userId),
      courseBooking: new Types.ObjectId(courseBookingId),
      type: 'credit',
      reason: 'course_refund',
      amount,
      currency: 'EUR',
      description,
    });
    await this.notifyWalletCredit(userId, amount, 'cliente');
    return movement;
  }

  async cancellationRefundAmountByBooking(bookingId: string): Promise<number> {
    if (!Types.ObjectId.isValid(bookingId)) {
      return 0;
    }

    const movement = await this.walletMovementModel.findOne({
      booking: new Types.ObjectId(bookingId),
      reason: 'cancellation_refund',
      type: 'credit',
    }).exec();

    return movement?.amount || 0;
  }

  async balance(userId: string): Promise<number> {
    const movements = await this.walletMovementModel
      .find({ user: new Types.ObjectId(userId) })
      .exec();

    return movements.reduce((total, movement) => {
      return movement.type === 'credit' ? total + movement.amount : total - movement.amount;
    }, 0);
  }

  async balances(userIds: string[]): Promise<Record<string, number>> {
    const ids = userIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (!ids.length) return {};

    const balances = await this.walletMovementModel.aggregate<{ _id: Types.ObjectId; balance: number }>([
      { $match: { user: { $in: ids } } },
      {
        $group: {
          _id: '$user',
          balance: {
            $sum: {
              $cond: [{ $eq: ['$type', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }]
            }
          }
        }
      }
    ]).exec();

    return Object.fromEntries(balances.map((item) => [item._id.toString(), item.balance]));
  }

  async summary(userId: string) {
    const movements = await this.walletMovementModel
      .find({ user: new Types.ObjectId(userId) })
      .populate('booking')
      .sort({ createdAt: -1 })
      .exec();

    const balance = movements.reduce((total, movement) => {
      return movement.type === 'credit' ? total + movement.amount : total - movement.amount;
    }, 0);

    return {
      currency: 'EUR',
      balance,
      movements,
    };
  }

  private async notifyWalletCredit(userId: string, amount: number, audience: 'gestore' | 'cliente' = 'gestore', title?: string): Promise<void> {
    await this.notificationsService.create({
      audience,
      userId,
      title: title || (audience === 'cliente' ? 'Rimborso accreditato' : 'Credito approvato'),
      message: `${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)} sono stati accreditati nel tuo wallet.`,
      type: 'wallet_credit_approved',
      link: '/wallet',
    });
  }
}
