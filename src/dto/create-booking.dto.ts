import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Min } from "class-validator";

export class CreateBookingDto {
  @ApiProperty({ description: 'Id dello spazio' })
  @IsString()
  spaceId: string;

  @ApiProperty({ description: 'Id utente cliente/gestore da associare', required: false })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiProperty({ example: 'Prenotazione sala', description: 'nome della prenotazione' })
  @IsString()
  name?: string;

  @ApiProperty({ example: '2030-01-01', description: 'data della prenotazione' })
  @IsString()
  date: string;

  @ApiProperty({ example: '12:00', description: 'orario di inizio della prenotazione' })
  @IsString()
  startTime: string;

  @ApiProperty({ example: '14:00', description: 'orario di fine della prenotazione' })
  @IsString()
  endTime: string;

  @ApiProperty({ example: 'whole_room', description: 'Stanza intera o postazione', required: false })
  @IsOptional()
  @IsIn(['whole_room', 'workstation'])
  rentalUnit?: 'whole_room' | 'workstation';

  @ApiProperty({ example: 'time', description: 'Acquisto a tempo o giornata intera', required: false })
  @IsOptional()
  @IsIn(['time', 'full_day'])
  rentalMode?: 'time' | 'full_day';

  @ApiProperty({ example: 1, description: 'Numero postazioni richieste', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  workstationQuantity?: number;

  @ApiProperty({ example: 'WELCOME10', description: 'Codice sconto', required: false })
  @IsOptional()
  @IsString()
  discountCode?: string;
}
