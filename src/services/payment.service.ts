import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Payment } from '../schemas/payment.schema';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreatePaymentDto } from '../dto/create-payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    return await this.paymentModel.create(createPaymentDto);
  }

  async findAll(status?: string): Promise<Payment[]> {
    const query: FilterQuery<Payment> = {};
    if (status) query.status = status;

    return await this.paymentModel
      .find(query)
      .populate({
        path: 'bookingId',
        populate: [
          { path: 'user' },
          { path: 'space' },
        ],
      })
      .exec();
  }

  async findByBooking(bookingId: string): Promise<Payment[]> {
    return await this.paymentModel.find({ bookingId: new Types.ObjectId(bookingId) }).exec();
  }
}
