import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { CreateSpaceDto } from './create-space.dto';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class UpdateSpaceDto extends PartialType(CreateSpaceDto) {
  @ApiProperty({ example: '#f3f4f6', description: 'Colore calendario della stanza', required: false })
  @IsOptional()
  @IsString()
  calendarColor?: string;

  @ApiProperty({ example: ['#f3f4f6', '#e5e7eb'], description: 'Colori calendario dei aree', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorColors?: string[];
}
