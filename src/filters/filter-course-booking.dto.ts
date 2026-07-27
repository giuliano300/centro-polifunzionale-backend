import { IsMongoId, IsOptional, IsString } from "class-validator";

export class FilterCourseBookingDto {
  @IsOptional() @IsMongoId() userId?: string;
  @IsOptional() @IsMongoId() courseId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() paymentStatus?: string;
  @IsOptional() @IsString() start?: string;
  @IsOptional() @IsString() end?: string;
}
