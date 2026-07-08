import { IsBoolean, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min } from "class-validator";

// create-course.dto.ts
export class CreateCourseDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsDateString()
  date: Date;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsMongoId()
  booking: string;

  @IsNumber()
  @Min(1)
  capacity: number;

  @IsEnum(['paid', 'free'])
  enrollmentType: 'paid' | 'free';

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
