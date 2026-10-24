import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { avatarsConfig } from './avatars.config';
import { DeleteAvatarCommand } from './commands/delete-avatar/delete-avatar.command';
import { UpdateProfileCommand } from './commands/update-profile/update-profile.command';
import { UploadAvatarCommand } from './commands/upload-avatar/upload-avatar.command';
import { ProfileController } from './profile.controller';
import { ProfileResponse } from './profile-response';
import { GetProfileQuery } from './queries/get-profile/get-profile.query';
import { AvatarStorageService } from './storage/avatar-storage.service';

describe('ProfileController', () => {
  const commandBus = { execute: jest.fn() };
  const queryBus = { execute: jest.fn() };
  const user = { id: 'user-id', email: 'user@example.com' };
  const profile: ProfileResponse = {
    id: 'user-id',
    email: 'user@example.com',
    name: 'Ann',
    avatarUrl: null,
  };
  let controller: ProfileController;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        // Dependencies of AvatarUploadInterceptor on the upload route.
        {
          provide: avatarsConfig.KEY,
          useValue: { dir: '/avatars', maxBytes: 1 },
        },
        { provide: AvatarStorageService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(ProfileController);
  });

  it('is guarded by JwtAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProfileController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('dispatches GetProfileQuery for the signed-in user', async () => {
    queryBus.execute.mockResolvedValue(profile);

    await expect(controller.getMe(user)).resolves.toBe(profile);
    expect(queryBus.execute).toHaveBeenCalledWith(
      new GetProfileQuery('user-id'),
    );
  });

  it.each([
    ['sets', { name: 'Ann' }, 'Ann'],
    ['clears', { name: null }, null],
    ['keeps', {}, undefined],
  ])(
    'dispatches UpdateProfileCommand that %s the name for the signed-in user',
    async (_case, dto, name) => {
      commandBus.execute.mockResolvedValue(profile);

      await expect(controller.updateMe(user, dto)).resolves.toBe(profile);
      expect(commandBus.execute).toHaveBeenCalledWith(
        new UpdateProfileCommand('user-id', name),
      );
    },
  );

  it('dispatches UploadAvatarCommand with the stored temp file for the signed-in user', async () => {
    commandBus.execute.mockResolvedValue(profile);
    const file = {
      path: '/avatars/incoming/temp',
      originalname: 'me.png',
      size: 103,
    } as Express.Multer.File;

    await expect(controller.uploadAvatar(user, file)).resolves.toBe(profile);
    expect(commandBus.execute).toHaveBeenCalledWith(
      new UploadAvatarCommand('user-id', {
        path: '/avatars/incoming/temp',
        originalName: 'me.png',
      }),
    );
  });

  it('dispatches DeleteAvatarCommand for the signed-in user', async () => {
    commandBus.execute.mockResolvedValue(undefined);

    await expect(controller.removeAvatar(user)).resolves.toBeUndefined();
    expect(commandBus.execute).toHaveBeenCalledWith(
      new DeleteAvatarCommand('user-id'),
    );
  });
});
