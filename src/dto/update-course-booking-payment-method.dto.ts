import { IsEnum } from "class-validator";
import { PaymentMethod } from "src/payments/payment-method.enum";

export class UpdateCourseBookingPaymentMethodDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
