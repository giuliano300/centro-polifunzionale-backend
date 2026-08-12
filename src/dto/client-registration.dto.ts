import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsArray, IsBoolean, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RequestClientRegistrationOtpDto {
  @ApiProperty({ example: 'Mario Rossi' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'mario.rossi@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '3331234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'RSSMRA80A01F839X' })
  @IsString()
  taxCode: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: true, description: 'Conferma di presa visione dell’informativa e accettazione del trattamento necessario alla registrazione' })
  @IsBoolean()
  @Equals(true)
  acceptedDataProcessing: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedTags?: string[];
}

export class ConfirmClientRegistrationOtpDto {
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
