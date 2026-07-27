import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

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
