import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../roles/user-role.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Mario Rossi', description: 'Nome utente' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'mario.rossi@gmail.com', description: 'Email utente' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+393331234567', description: 'Telefono utente', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'RSSMRA80A01F839X', description: 'Codice fiscale utente', required: false })
  @IsString()
  @IsOptional()
  taxCode?: string;

  @ApiProperty({ example: '123456', description: 'Password utente, minimo 6 caratteri' })
  @IsString()
  @MinLength(6)
  password: string;
  
  @ApiProperty({ example: 'cliente', description: 'Ruolo utente' })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ example: true, description: 'Utente attivo', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: ['yoga', 'fitness'], description: 'Tag di interesse cliente', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interestedTags?: string[];
}
