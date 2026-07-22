import { IsArray, IsBoolean, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDiscountCodeDto {
  @IsString()
  code: string;

  @IsIn(['percentage', 'fixed'])
  type: 'percentage' | 'fixed';

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsIn(['all', 'booking', 'course'])
  target?: 'all' | 'booking' | 'course';

  @IsOptional()
  @IsMongoId({ each: true })
  spaceIds?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(['admin', 'gestore', 'cliente'], { each: true })
  userRoles?: string[];

  @IsOptional()
  @IsIn(['manual', 'new_user', 'monthly_purchases'])
  rule?: 'manual' | 'new_user' | 'monthly_purchases';

  @IsOptional()
  @IsNumber()
  @Min(1)
  newUserDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPurchaseMin?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validTo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxUses?: number;
}

export class UpdateDiscountCodeDto extends CreateDiscountCodeDto {}
