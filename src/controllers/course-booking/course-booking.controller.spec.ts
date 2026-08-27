import { Test, TestingModule } from '@nestjs/testing';
import { CourseBookingsController } from './course-booking.controller';
import { CourseBookingsService } from '../../services/course-booking.service';

describe('CourseBookingsController', () => {
  let controller: CourseBookingsController;
  let courseBookingsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    remove: jest.Mock;
    updatePaymentMethod: jest.Mock;
  };

  beforeEach(async () => {
    courseBookingsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      remove: jest.fn(),
      updatePaymentMethod: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseBookingsController],
      providers: [
        {
          provide: CourseBookingsService,
          useValue: courseBookingsService,
        },
      ],
    }).compile();

    controller = module.get<CourseBookingsController>(CourseBookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('forces client course booking creation on the logged client user', async () => {
    courseBookingsService.create.mockResolvedValue({});

    await controller.create({ courseId: 'course-1', userId: 'other-user' } as any, {
      user: { role: 'cliente', userId: 'client-1' },
    });

    expect(courseBookingsService.create).toHaveBeenCalledWith(
      { courseId: 'course-1', userId: 'client-1' },
      'client-1',
      undefined,
    );
  });

  it('limits manager course booking list with managerId', async () => {
    courseBookingsService.findAll.mockResolvedValue([]);

    await controller.findAll({ courseId: 'course-1' } as any, {
      user: { role: 'gestore', userId: 'manager-1' },
    });

    expect(courseBookingsService.findAll).toHaveBeenCalledWith({ courseId: 'course-1', managerId: 'manager-1' });
  });

  it('limits client payment method changes to the logged client user', async () => {
    courseBookingsService.updatePaymentMethod.mockResolvedValue({});

    await controller.updatePaymentMethod('course-booking-1', { paymentMethod: 'cash' } as any, {
      user: { role: 'cliente', userId: 'client-1' },
    });

    expect(courseBookingsService.updatePaymentMethod).toHaveBeenCalledWith('course-booking-1', 'cash', 'client-1');
  });
});
