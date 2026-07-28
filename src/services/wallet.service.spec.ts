import { Types } from 'mongoose';
import { UserRole } from 'src/roles/user-role.enum';
import { WalletService } from './wallet.service';

describe('WalletService', () => {
  const walletMovementModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };
  const userModel = {
    findById: jest.fn(),
  };
  const notificationsService = {
    create: jest.fn(),
  };

  let service: WalletService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WalletService(walletMovementModel as any, userModel as any, notificationsService as any);
  });

  it('calculates balance using credits minus debits', async () => {
    walletMovementModel.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { type: 'credit', amount: 20 },
        { type: 'debit', amount: 7 },
        { type: 'credit', amount: 3 },
      ]),
    });

    await expect(service.balance(new Types.ObjectId().toString())).resolves.toBe(16);
  });

  it('does not create debit movements with zero amount', async () => {
    await expect(
      service.debitBookingPayment(new Types.ObjectId().toString(), new Types.ObjectId().toString(), 0),
    ).resolves.toBeNull();
    expect(walletMovementModel.create).not.toHaveBeenCalled();
  });

  it('updates an existing cancellation refund instead of duplicating it', async () => {
    const existing = {
      amount: 10,
      description: 'old',
      save: jest.fn().mockResolvedValue({ amount: 8 }),
    };
    walletMovementModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(existing),
    });

    await expect(
      service.creditCancellationRefund(new Types.ObjectId().toString(), new Types.ObjectId().toString(), 8, 'Rimborso parziale'),
    ).resolves.toEqual({ amount: 8 });

    expect(existing.amount).toBe(8);
    expect(existing.description).toBe('Rimborso parziale');
    expect(walletMovementModel.create).not.toHaveBeenCalled();
  });

  it('creates a manual one-time credit for a non-admin user', async () => {
    const userId = new Types.ObjectId().toString();
    const movement = { amount: 15, reason: 'manual' };
    userModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: userId, role: UserRole.Cliente }),
    });
    walletMovementModel.create.mockResolvedValue(movement);

    await expect(service.creditManual(userId, 15, 'Credito test')).resolves.toEqual(movement);

    expect(walletMovementModel.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'credit',
      reason: 'manual',
      amount: 15,
      currency: 'EUR',
      description: 'Credito test',
    }));
    expect(notificationsService.create).toHaveBeenCalledWith(expect.objectContaining({
      audience: 'cliente',
      userId,
      title: 'Credito wallet accreditato',
    }));
  });
});
