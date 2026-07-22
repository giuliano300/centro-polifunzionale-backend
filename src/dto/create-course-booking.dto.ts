import { IsMongoId, IsOptional, IsString } from "class-validator";

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
}
