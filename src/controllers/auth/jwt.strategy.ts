import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'a-string-secret-at-least-256-bits-long',
    });
  }

  async validate(payload: JwtPayload) {
    // Qui Passport inserirà il risultato in request.user
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
