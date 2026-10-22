import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileResponse, toProfileResponse } from '../../profile-response';
import { UpdateProfileCommand } from './update-profile.command';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    userId,
    name,
  }: UpdateProfileCommand): Promise<ProfileResponse> {
    try {
      // Prisma skips undefined fields, so an omitted name stays as it is.
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { name },
      });
      return toProfileResponse(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }
}
