import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../services/users.service';
import { getModelToken } from '@nestjs/mongoose';
import { ManagerRegistrationOtp } from 'src/schemas/manager-registration-otp.schema';
import { ManagerPasswordReset } from 'src/schemas/manager-password-reset.schema';
import { ClientRegistrationOtp } from 'src/schemas/client-registration-otp.schema';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
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
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
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
});
