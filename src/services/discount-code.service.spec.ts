import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DiscountCodeService } from './discount-code.service';

describe('DiscountCodeService', () => {
  const discountModel = {
    findOne: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
  };

  let service: DiscountCodeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiscountCodeService(discountModel as any);
  });

  it('applies a manual percentage discount only on allowed spaces and dates', async () => {
    const spaceId = new Types.ObjectId().toString();
    discountModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        code: 'ESTATE10',
        isActive: true,
        target: 'booking',
        spaces: [new Types.ObjectId(spaceId)],
        userRoles: [],
        rule: 'manual',
        type: 'percentage',
        value: 10,
        validFrom: new Date('2026-07-01T00:00:00.000Z'),
        validTo: new Date('2026-07-31T23:59:59.999Z'),
        usedCount: 0,
      }),
    });

    await expect(
      service.apply('estate10', 'booking', 100, spaceId, '2026-07-15'),
    ).resolves.toEqual({ code: 'ESTATE10', amount: 10 });
  });

  it('rejects a code for a different target', async () => {
    discountModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        code: 'CORSO5',
        isActive: true,
        target: 'course',
        spaces: [],
        userRoles: [],
        rule: 'manual',
        type: 'fixed',
        value: 5,
        usedCount: 0,
      }),
    });

    await expect(service.apply('CORSO5', 'booking', 50)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('chooses the best automatic discount for the user context', async () => {
    discountModel.find.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          code: 'NUOVO5',
          isActive: true,
          isAutomatic: true,
          target: 'all',
          spaces: [],
          userRoles: ['cliente'],
          rule: 'new_user',
          newUserDays: 30,
          type: 'fixed',
          value: 5,
          usedCount: 0,
        },
        {
          code: 'FEDELE20',
          isActive: true,
          isAutomatic: true,
          target: 'course',
          spaces: [],
          userRoles: ['cliente'],
          rule: 'monthly_purchases',
          monthlyPurchaseMin: 3,
          type: 'percentage',
          value: 20,
          usedCount: 0,
        },
      ]),
    });

    await expect(
      service.apply(undefined, 'course', 100, undefined, '2026-07-28', {
        role: 'cliente',
        createdAt: new Date(),
        monthlyPurchaseCount: 4,
      }),
    ).resolves.toEqual({ code: 'FEDELE20', amount: 20 });
  });
});
