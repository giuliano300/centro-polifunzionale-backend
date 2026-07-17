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
      message: `Il backoffice ha accreditato ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)} nel tuo portafogli.`,
      type: 'wallet_credit_approved',
      link: '/wallet',
    });
  }
}
