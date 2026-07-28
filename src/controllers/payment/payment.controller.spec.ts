import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from '../../services/payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: {
    create: jest.Mock;
    confirmBookingPayment: jest.Mock;
    createCheckoutSession: jest.Mock;
    sendBookingPaymentLink: jest.Mock;
    findAll: jest.Mock;
    findByBooking: jest.Mock;
  };

  beforeEach(async () => {
    paymentService = {
      create: jest.fn(),
      confirmBookingPayment: jest.fn(),
      createCheckoutSession: jest.fn(),
      sendBookingPaymentLink: jest.fn(),
      findAll: jest.fn(),
      findByBooking: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: paymentService,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('limits manager payment list to the logged user', async () => {
    paymentService.findAll.mockResolvedValue([]);

    await controller.findAll('PAID', '2026-07-01', '2026-08-01', 'sala', {
      user: { role: 'gestore', userId: 'manager-1' },
    });

    expect(paymentService.findAll).toHaveBeenCalledWith({
      status: 'PAID',
      start: '2026-07-01',
      end: '2026-08-01',
      search: 'sala',
      userId: 'manager-1',
    });
  });

  it('does not limit admin payment list by user', async () => {
    paymentService.findAll.mockResolvedValue([]);

    await controller.findAll(undefined, undefined, undefined, undefined, {
      user: { role: 'admin', userId: 'admin-1' },
    });

    expect(paymentService.findAll).toHaveBeenCalledWith({
      status: undefined,
      start: undefined,
      end: undefined,
      search: undefined,
      userId: undefined,
    });
  });

  it('uses the logged manager id when confirming a booking payment', async () => {
    paymentService.confirmBookingPayment.mockResolvedValue({});

    await controller.confirmBookingPayment('booking-1', { amount: 20, method: 'cash' }, {
      user: { role: 'gestore', userId: 'manager-1' },
    });

    expect(paymentService.confirmBookingPayment).toHaveBeenCalledWith(
      'booking-1',
      { amount: 20, method: 'cash', transactionId: undefined },
      'manager-1',
    );
  });
});
