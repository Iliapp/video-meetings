'use client';

import { FieldError, InputGroup, Label, TextField } from '@heroui/react';
import type { Ref } from 'react';

export const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

export function EmailField({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <TextField
      fullWidth
      className="gap-2"
      isRequired
      name="email"
      type="email"
      value={value}
      onChange={onChange}
      validate={(value) =>
        isEmail(value) ? null : 'Enter an email address like name@company.com'
      }
    >
      <Label>Email</Label>
      <InputGroup fullWidth className="h-12">
        <InputGroup.Input
          ref={inputRef}
          autoComplete="email"
          placeholder="name@company.com"
        />
      </InputGroup>
      <FieldError className="px-0 text-sm" />
    </TextField>
  );
}
