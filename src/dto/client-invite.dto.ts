import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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
}

export class CompleteClientInviteDto {
  @IsString()
  token: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
