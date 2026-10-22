import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileResponse, toProfileResponse } from '../../profile-response';
import { GetProfileQuery } from './get-profile.query';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId }: GetProfileQuery): Promise<ProfileResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toProfileResponse(user);
  }
}
