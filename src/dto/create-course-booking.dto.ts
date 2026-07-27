import { IsEnum, IsMongoId, IsOptional, IsString } from "class-validator";
import { PaymentMethod } from "src/payments/payment-method.enum";

export class CreateCourseBookingDto {
  @IsMongoId()
  courseId: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  discountCode?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
