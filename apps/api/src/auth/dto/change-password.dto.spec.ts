import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';

describe('ChangePasswordDto', () => {
  const errorsFor = async (body: object) =>
    (await validate(plainToInstance(ChangePasswordDto, body))).map(
      (error) => error.property,
    );

  it('accepts a current password and a new one of 8 characters', async () => {
    await expect(
      errorsFor({ currentPassword: 'old', newPassword: 'a'.repeat(8) }),
    ).resolves.toEqual([]);
  });

  it.each([
    [
      'currentPassword is missing',
      { newPassword: 'N3wPassword!' },
      'currentPassword',
    ],
    [
      'currentPassword is empty',
      { currentPassword: '', newPassword: 'N3wPassword!' },
      'currentPassword',
    ],
    [
      'currentPassword is not a string',
      { currentPassword: 123, newPassword: 'N3wPassword!' },
      'currentPassword',
    ],
    ['newPassword is missing', { currentPassword: 'old' }, 'newPassword'],
    [
      'newPassword is shorter than 8 characters',
      { currentPassword: 'old', newPassword: 'a'.repeat(7) },
      'newPassword',
    ],
    [
      'newPassword is not a string',
      { currentPassword: 'old', newPassword: 12345678 },
      'newPassword',
    ],
  ])('rejects the body when %s', async (_case, body, property) => {
    await expect(errorsFor(body)).resolves.toEqual([property]);
  });
});
