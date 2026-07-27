import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { CourseApprovalStatus } from "src/courses/course-approval-status.enum";
import { CourseTag } from "src/courses/course-tag.enum";

export class CourseImageCropDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  @Min(1)
  scale: number;
}

// create-course.dto.ts
export class CreateCourseDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  @IsEnum(CourseTag, { each: true })
  tags?: CourseTag[];

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CourseImageCropDto)
  imageCrop?: CourseImageCropDto;

  @IsOptional()
  @IsString()
  bannerImageUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CourseImageCropDto)
  bannerImageCrop?: CourseImageCropDto;

  @IsOptional()
  @IsString()
  cardImageUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CourseImageCropDto)
  cardImageCrop?: CourseImageCropDto;

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

  @IsOptional()
  @IsEnum(CourseApprovalStatus)
  approvalStatus?: CourseApprovalStatus;
}
