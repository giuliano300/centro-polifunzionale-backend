import { IsBoolean, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateCourseTagDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  value: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCourseTagDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}
