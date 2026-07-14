import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Payment } from '../schemas/payment.schema';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { Booking, BookingDocument } from 'src/schemas/booking.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const payment = await this.paymentModel.create(createPaymentDto);
    if (payment.status === 'PAID') {
      await this.bookingModel.findByIdAndUpdate(payment.bookingId, { status: 'confirmed' }).exec();
    }
    return payment;
  }

  async findAll(filters: { status?: string; start?: string; end?: string; search?: string } = {}): Promise<Payment[]> {
    const query: FilterQuery<Payment> = {};
    if (filters.status) query.status = filters.status;

    const payments = await this.paymentModel
      .find(query)
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'user' },
          { path: 'space' },
        ],
      })
      .exec();

    const normalizedSearch = filters.search?.trim().toLowerCase();
    return payments.filter((payment: any) => {
      const booking = payment.bookingId;
      const bookingDate = booking?.date ? new Date(booking.date) : null;
      const inStart = !filters.start || (bookingDate && bookingDate >= new Date(filters.start));
      const inEnd = !filters.end || (bookingDate && bookingDate <= new Date(filters.end));
      const text = [
        payment.status,
        payment.method,
        payment.transactionId,
        booking?.name,
        booking?.user?.name,
        booking?.user?.email,
        booking?.space?.name,
      ].join(' ').toLowerCase();

      return !!inStart && !!inEnd && (!normalizedSearch || text.includes(normalizedSearch));
    });
  }

  async findByBooking(bookingId: string, allowedUserId?: string): Promise<Payment[]> {
    if (allowedUserId) {
      const booking = await this.bookingModel.findById(bookingId).exec();
      if (!booking) {
        throw new NotFoundException('Prenotazione non trovata');
      }

      if (booking.user.toString() !== allowedUserId) {
        throw new ForbiddenException('Pagamenti non accessibili');
      }
    }

    return await this.paymentModel.find({ bookingId: new Types.ObjectId(bookingId) }).exec();
  }
}
