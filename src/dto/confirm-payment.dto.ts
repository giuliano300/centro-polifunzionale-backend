import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @IsOptional()
  @IsNumber()
  @ApiProperty({ example: 30, required: false, description: 'Importo pagato, usato se non esiste un pending' })
  amount?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'manual', required: false, description: 'Metodo o provider di pagamento' })
  method?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'MANUAL-123456', required: false, description: 'Id transazione del provider' })
  transactionId?: string;
}
