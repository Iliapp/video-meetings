// Same rule as the api's RegisterDto and ChangePasswordDto.
export const MIN_PASSWORD_LENGTH = 8;

export const validateNewPassword = (value: string) =>
  value.length >= MIN_PASSWORD_LENGTH
    ? null
    : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
