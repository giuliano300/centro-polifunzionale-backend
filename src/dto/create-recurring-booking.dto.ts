import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBookingDto } from './create-booking.dto';

export class RecurringBookingReplacementDto {
  @IsString() originalDate: string;
  @IsString() date: string;
  @IsString() startTime: string;
  @IsString() endTime: string;
}

export class CreateRecurringBookingDto extends CreateBookingDto {
  @ApiProperty({ example: '2030-03-31', description: 'Ultimo giorno dell’intervallo settimanale' })
  @IsString()
  endDate: string;

  @ApiProperty({ enum: ['full', 'automatic'] })
  @IsIn(['full', 'automatic'])
  paymentPlan: 'full' | 'automatic';

  @ApiProperty({ required: false, description: 'Date non disponibili da saltare, confermate dalla preview' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedDates?: string[];

  @ApiProperty({ required: false, type: [RecurringBookingReplacementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringBookingReplacementDto)
  replacements?: RecurringBookingReplacementDto[];
}

export class RecurringAvailabilityQueryDto {
  @IsString() spaceId: string;
  @IsString() startDate: string;
  @IsString() endDate: string;
  @IsString() startTime: string;
  @IsString() endTime: string;
  @IsOptional() @IsString() rentalMode?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) workstationQuantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sectorQuantity?: number;
  @IsOptional() @IsString() sectorIndexes?: string;
}
