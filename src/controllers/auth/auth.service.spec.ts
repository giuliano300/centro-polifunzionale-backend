import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../services/users.service';
import { getModelToken } from '@nestjs/mongoose';
import { ManagerRegistrationOtp } from 'src/schemas/manager-registration-otp.schema';
import { ManagerPasswordReset } from 'src/schemas/manager-password-reset.schema';
import { ClientRegistrationOtp } from 'src/schemas/client-registration-otp.schema';
import { SocialAuthCompletion } from 'src/schemas/social-auth-completion.schema';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  const usersServiceMock = {
    findByEmail: jest.fn(),
    findBySocialIdentity: jest.fn(),
    linkSocialIdentity: jest.fn(),
    unlinkSocialIdentity: jest.fn(),
    create: jest.fn(),
  };
  const modelMock = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    deleteOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        { provide: getModelToken(ManagerRegistrationOtp.name), useValue: modelMock },
        { provide: getModelToken(ManagerPasswordReset.name), useValue: modelMock },
        { provide: getModelToken(ClientRegistrationOtp.name), useValue: modelMock },
        { provide: getModelToken(SocialAuthCompletion.name), useValue: modelMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_: string, fallback: string) => fallback),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('does not reuse a linked Google subject when the verified email is different', async () => {
    jest.spyOn(service as any, 'verifySocialIdentity').mockResolvedValue({
      subject: 'google-subject-11',
      email: 'valente.giuliano11@gmail.com',
      name: 'Giuliano Valente',
    });
    usersServiceMock.findBySocialIdentity.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      email: 'valente.giuliano@gmail.com',
    });
    usersServiceMock.findByEmail.mockResolvedValue(null);

    const result = await service.socialSignIn({
      provider: 'google',
      idToken: 'valid-token',
    });

    expect(usersServiceMock.unlinkSocialIdentity).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'google',
      'google-subject-11',
    );
    expect(result).toMatchObject({
      completionRequired: true,
      profile: { email: 'valente.giuliano11@gmail.com' },
    });
  });
});
