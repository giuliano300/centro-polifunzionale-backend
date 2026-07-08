import { IsOptional, IsString, IsDateString } from 'class-validator';

export class FilterBookingsDto {
  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()       // qui stringa, non Date
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsString()       // qui stringa, non Date
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
