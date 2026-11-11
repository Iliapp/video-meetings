import { randomUUID } from 'node:crypto';
import { toProfileResponse, withAvatarBaseUrl } from './profile-response';

describe('profile-response', () => {
  const user = {
    id: 'user-id',
    email: 'user@example.com',
    name: 'Ann',
    avatarKey: null,
    avatarMimeType: null,
    passwordHash: 'hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('has a null avatarUrl without an avatar and no internal fields', () => {
    expect(toProfileResponse(user)).toEqual({
      id: 'user-id',
      email: 'user@example.com',
      name: 'Ann',
      avatarUrl: null,
    });
  });

  it('points avatarUrl at /avatars/<key>, which changes with every upload', () => {
    const avatarKey = randomUUID();

    expect(
      toProfileResponse({ ...user, avatarKey, avatarMimeType: 'image/png' })
        .avatarUrl,
    ).toBe(`/avatars/${avatarKey}`);
  });

  it('makes avatarUrl absolute against the base URL', () => {
    const profile = { ...toProfileResponse(user), avatarUrl: '/avatars/k' };

    expect(withAvatarBaseUrl(profile, 'https://example.com/api')).toEqual({
      ...profile,
      avatarUrl: 'https://example.com/api/avatars/k',
    });
  });

  it('keeps a null avatarUrl null', () => {
    const profile = toProfileResponse(user);

    expect(withAvatarBaseUrl(profile, 'https://example.com')).toEqual(profile);
  });
});
