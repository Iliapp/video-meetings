import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto', () => {
  const check = async (body: object) => {
    const dto = plainToInstance(UpdateProfileDto, body);
    return { dto, errors: await validate(dto) };
  };

  it('trims the name', async () => {
    const { dto, errors } = await check({ name: '  Ann  ' });

    expect(errors).toEqual([]);
    expect(dto.name).toBe('Ann');
  });

  it('accepts 100 characters after trimming', async () => {
    const name = 'a'.repeat(100);

    const { dto, errors } = await check({ name: ` ${name} ` });

    expect(errors).toEqual([]);
    expect(dto.name).toBe(name);
  });

  it.each([{}, { name: null }])('accepts %j', async (body) => {
    const { errors } = await check(body);

    expect(errors).toEqual([]);
  });

  it.each([
    ['blank', '   '],
    ['empty', ''],
    ['longer than 100 characters', 'a'.repeat(101)],
    ['not a string', 123],
  ])('rejects a name that is %s', async (_case, name) => {
    const { errors } = await check({ name });

    expect(errors.map((error) => error.property)).toEqual(['name']);
  });
});
