import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RequestManagerPasswordResetDto {
  @ApiProperty({ example: 'mario.rossi@gmail.com' })
  @IsEmail()
  email: string;
}

export class ConfirmManagerPasswordResetDto {
  @ApiProperty({ example: 'reset-token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(6)
  password: string;
}
