import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

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
