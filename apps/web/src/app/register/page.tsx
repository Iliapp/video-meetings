import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth-layout';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Create account · Video Meetings',
};

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start and join video meetings with your team."
    >
      <RegisterForm />
    </AuthLayout>
  );
}
