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

export class SpaceSectorRecurringSettingDto {
  @IsInt()
  @Min(0)
  sectorIndex: number;

  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @IsIn(['full', 'automatic'], { each: true })
  paymentOptions: Array<'full' | 'automatic'>;

  @IsInt()
  @Min(1)
  @Max(90)
  chargeAdvanceDays: number;
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

  @ApiProperty({ example: true, description: 'Permette di vendere la stanza non coworking per aree', required: false })
  @IsOptional()
  @IsBoolean()
  sectorEnabled?: boolean;

  @ApiProperty({ example: 2, description: 'Numero aree acquistabili della stanza', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  sectorCount?: number;

  @ApiProperty({ example: 60, description: 'Prezzo per area e frazione oraria', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sectorRate?: number;

  @ApiProperty({ example: 180, description: 'Prezzo giornata per area', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sectorDailyRate?: number;

  @ApiProperty({ example: ['Lato finestra', 'Lato ingresso'], description: 'Nomi dei aree della stanza', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorNames?: string[];

  @ApiProperty({ example: '#dbeafe', description: 'Colore calendario della stanza', required: false })
  @IsOptional()
  @IsString()
  calendarColor?: string;

  @ApiProperty({ example: ['#dbeafe', '#dcfce7'], description: 'Colori calendario dei aree', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorColors?: string[];

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

  @ApiProperty({ example: ['full', 'automatic'], required: false })
  @IsOptional()
  @IsArray()
  @IsIn(['full', 'automatic'], { each: true })
  recurringPaymentOptions?: Array<'full' | 'automatic'>;

  @ApiProperty({ example: true, description: 'Abilita gli acquisti ricorrenti della stanza intera', required: false })
  @IsOptional()
  @IsBoolean()
  recurringEnabled?: boolean;

  @ApiProperty({ example: 7, description: 'Giorni di anticipo per gli addebiti automatici', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  recurringChargeAdvanceDays?: number;

  @ApiProperty({ description: 'Configurazione ricorrenza specifica per ciascuna area', required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpaceSectorRecurringSettingDto)
  sectorRecurringSettings?: SpaceSectorRecurringSettingDto[];

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
