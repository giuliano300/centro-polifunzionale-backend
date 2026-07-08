import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { UserRole } from "src/roles/roles.decorator";

// dto/update-user.dto.ts
export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  taxCode?: string;

  @IsOptional()
  @IsEnum(['admin', 'gestore', 'cliente'])
  role?: UserRole;
}
