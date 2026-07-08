import { Test, TestingModule } from '@nestjs/testing';
import { CourseBookingsController } from './course-booking.controller';
import { CourseBookingsService } from '../../services/course-booking.service';

describe('CourseBookingsController', () => {
  let controller: CourseBookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseBookingsController],
      providers: [
        {
          provide: CourseBookingsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CourseBookingsController>(CourseBookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
