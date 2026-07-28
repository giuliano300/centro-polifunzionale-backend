import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './booking.controller';
import { BookingService } from '../../services/booking.service';
import { ForbiddenException } from '@nestjs/common';

describe('BookingsController', () => {
  let controller: BookingsController;
  let bookingsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    availability: jest.Mock;
    requestCancellation: jest.Mock;
    approveCancellation: jest.Mock;
  };

  beforeEach(async () => {
    bookingsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      availability: jest.fn(),
      requestCancellation: jest.fn(),
      approveCancellation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [
        {
          provide: BookingService,
          useValue: bookingsService,
        },
      ],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forces client booking creation on the logged client user', async () => {
    bookingsService.create.mockResolvedValue({});

    await controller.create({ userId: 'other-user', spaceId: 'space-1' } as any, {
      user: { role: 'cliente', userId: 'client-1' },
    });

    expect(bookingsService.create).toHaveBeenCalledWith(
      { userId: 'client-1', spaceId: 'space-1' },
      'client-1',
    );
  });

  it('limits manager and client booking list to the logged user', async () => {
    bookingsService.findAll.mockResolvedValue([]);

    await controller.findAll({ spaceId: 'space-1' } as any, {
      user: { role: 'gestore', userId: 'manager-1' },
    });

    expect(bookingsService.findAll).toHaveBeenCalledWith({ spaceId: 'space-1', userId: 'manager-1' });
  });

  it('blocks a client from opening another user booking', async () => {
    bookingsService.findOne.mockResolvedValue({ user: 'client-2' });

    await expect(
      controller.findOne('booking-1', { user: { role: 'cliente', userId: 'client-1' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
