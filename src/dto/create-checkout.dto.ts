import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsEnum(['stripe', 'paypal', 'nexi'])
  @ApiProperty({ example: 'stripe', enum: ['stripe', 'paypal', 'nexi'] })
  provider: 'stripe' | 'paypal' | 'nexi';

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'http://localhost:4400/bookings?payment=success', required: false })
  successUrl?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ example: 'http://localhost:4400/bookings?payment=cancel', required: false })
  cancelUrl?: string;
}
