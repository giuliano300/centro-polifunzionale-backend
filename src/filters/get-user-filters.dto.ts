import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { UserRole } from "src/roles/user-role.enum";

export class GetUsersFilterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserRole)
  excludeRole?: UserRole;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  sortBy?: string;

  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
