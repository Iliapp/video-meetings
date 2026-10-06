'use client';

import { Eye, EyeSlash } from '@gravity-ui/icons';
import {
  Button,
  Description,
  FieldError,
  InputGroup,
  Label,
  TextField,
} from '@heroui/react';
import { useState, type Ref } from 'react';

export function PasswordField({
  value,
  onChange,
  autoComplete,
  validate,
  description,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  validate: (value: string) => string | null;
  description?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
      fullWidth
      className="gap-2"
      isRequired
      name="password"
      type={isVisible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      validate={validate}
    >
      <Label>Password</Label>
      <InputGroup fullWidth className="h-12">
        <InputGroup.Input ref={inputRef} autoComplete={autoComplete} />
        <InputGroup.Suffix className="pe-0.5">
          <Button
            isIconOnly
            className="size-11"
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            size="sm"
            variant="ghost"
            onPress={() => setIsVisible((visible) => !visible)}
          >
            {isVisible ? (
              <EyeSlash className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      {description && (
        <Description className="text-sm">{description}</Description>
      )}
      <FieldError className="px-0 text-sm" />
    </TextField>
  );
}
