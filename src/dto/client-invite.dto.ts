import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from 'src/roles/user-role.enum';

export class InviteClientDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole.Cliente | UserRole.Gestore;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedTags?: string[];
}

export class CompleteClientInviteDto {
  @IsString()
  token: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsBoolean()
  acceptedDataProcessing: boolean;

  @IsOptional()
  @IsString()
  phoneOtp?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedTags?: string[];
}

export class RequestClientInvitePhoneOtpDto {
  @IsString()
  token: string;

  @IsString()
  phone: string;
}
