import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SocialSignInDto {
  @IsIn(['google', 'apple'])
  provider: 'google' | 'apple';

  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class RequestSocialPhoneOtpDto {
  @IsString()
  completionToken: string;

  @IsString()
  @Matches(/^3[0-9]{8,9}$/)
  phone: string;
}

export class CompleteSocialRegistrationDto {
  @IsString()
  completionToken: string;

  @IsString()
  name: string;

  @IsString()
  @Matches(/^3[0-9]{8,9}$/)
  phone: string;

  @IsString()
  taxCode: string;

  @IsString()
  @Matches(/^[0-9]{6}$/)
  phoneOtp: string;

  @IsBoolean()
  acceptedDataProcessing: boolean;
}
