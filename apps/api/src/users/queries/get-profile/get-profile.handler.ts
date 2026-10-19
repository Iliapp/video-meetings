import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../../prisma/prisma.service';
import { Profile, profileSelect, toProfile } from '../../profile';
import { GetProfileQuery } from './get-profile.query';

@QueryHandler(GetProfileQuery)
export class GetProfileHandler implements IQueryHandler<GetProfileQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId }: GetProfileQuery): Promise<Profile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toProfile(user);
  }
}
