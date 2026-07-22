import { Booking } from 'src/schemas/booking.schema';
import { Payment } from 'src/schemas/payment.schema';

export interface BookingWithPayments {
  booking:Booking;
  payments: Payment[];
  cancellationRefundAmount?: number;
}
