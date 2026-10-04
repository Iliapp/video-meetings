import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../generated/prisma/client';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async issue(user: User): Promise<AuthResponseDto> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { accessToken };
  }
}
