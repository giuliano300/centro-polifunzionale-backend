import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class RequestManagerRegistrationOtpDto {
  @ApiProperty({ example: 'Mario Rossi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'mario.rossi@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+393331234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'RSSMRA80A01F839X' })
  @IsString()
  @IsNotEmpty()
  taxCode: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: true, description: 'Conferma di presa visione dell’informativa e accettazione del trattamento necessario alla registrazione' })
  @IsBoolean()
  @Equals(true)
  acceptedDataProcessing: boolean;
}

export class ConfirmManagerRegistrationOtpDto {
  @ApiProperty({ example: 'mario.rossi@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  emailOtp: string;

  @ApiProperty({ example: '654321' })
  @IsString()
  @Matches(/^[0-9]{6}$/)
  phoneOtp: string;
}
