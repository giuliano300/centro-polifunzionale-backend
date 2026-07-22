import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PAYMENT_METHOD_VALUES, PaymentMethod } from '../payments/payment-method.enum';

export class SpaceOpeningSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @IsBoolean()
  isOpen: boolean;

  @IsString()
  openTime: string;

  @IsString()
  closeTime: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxConsecutiveTimeSlots?: number;
}

export class SpaceExceptionalClosureDto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateSpaceDto {
  @ApiProperty({ example: 'Sala Yoga', description: 'Nome dello spazio' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Spazio per yoga e meditazione', description: 'Descrizione dello spazio' })
  @IsString()
  description: string;

  @ApiProperty({ example: 20, description: 'Prezzo della frazione configurata in euro' })
  @IsNumber()
  hourlyRate: number;

  @ApiProperty({ example: 120, description: 'Prezzo giornata in euro', required: false })
  @IsOptional()
  @IsNumber()
  dailyRate?: number;

  @ApiProperty({ example: 'whole_room', description: 'Tipo affitto: stanza intera o postazione', required: false })
  @IsOptional()
  @IsIn(['whole_room', 'workstation'])
  rentalUnit?: 'whole_room' | 'workstation';

  @ApiProperty({ example: ['time'], description: 'Modalita di acquisto consentite', required: false })
  @IsOptional()
  @IsArray()
  @IsIn(['time', 'full_day'], { each: true })
  rentalModes?: Array<'time' | 'full_day'>;

  @ApiProperty({ example: 60, description: 'Frazionamento minimo in minuti', required: false })
  @IsOptional()
  @IsInt()
  @Min(15)
  timeSlotMinutes?: number;

  @ApiProperty({ example: 1, description: 'Numero massimo di frazioni consecutive acquistabili contemporaneamente', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConsecutiveTimeSlots?: number;

  @ApiProperty({ example: 8, description: 'Numero postazioni disponibili se coworking', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  workstationCount?: number;

  @ApiProperty({ example: 2, description: 'Ore prima dell inizio prenotazione oltre cui non e piu possibile creare un corso', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  courseCreationAdvanceHours?: number;

  @ApiProperty({ example: ['cash', 'stripe', 'paypal', 'nexi'], description: 'Metodi di pagamento consentiti per lo spazio', required: false })
  @IsOptional()
  @IsArray()
  @IsIn(PAYMENT_METHOD_VALUES, { each: true })
  paymentMethods?: PaymentMethod[];

  @ApiProperty({ description: 'Orari settimanali di apertura e chiusura', required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpaceOpeningSlotDto)
  openingHours?: SpaceOpeningSlotDto[];

  @ApiProperty({ description: 'Giorni o intervalli di chiusura eccezionale', required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpaceExceptionalClosureDto)
  exceptionalClosures?: SpaceExceptionalClosureDto[];

  @ApiProperty({ example: true, description: 'Disponibilita dello spazio', required: false })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
