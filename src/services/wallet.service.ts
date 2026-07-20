import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WalletMovement, WalletMovementDocument } from 'src/schemas/wallet-movement.schema';
import { NotificationsService } from './notifications.service';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(WalletMovement.name) private walletMovementModel: Model<WalletMovementDocument>,
    private notificationsService: NotificationsService,
  ) {}

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

  async balance(userId: string): Promise<number> {
    const movements = await this.walletMovementModel
      .find({ user: new Types.ObjectId(userId) })
      .exec();

    return movements.reduce((total, movement) => {
      return movement.type === 'credit' ? total + movement.amount : total - movement.amount;
    }, 0);
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

  private async notifyWalletCredit(userId: string, amount: number): Promise<void> {
    await this.notificationsService.create({
      audience: 'gestore',
      userId,
      title: 'Credito approvato',
      message: `Il backoffice ha accreditato ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)} nel tuo wallet.`,
      type: 'wallet_credit_approved',
      link: '/wallet',
    });
  }
}
