import type { Metadata } from 'next';
import { AuthLayout } from '@/components/auth-layout';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in · Video Meetings',
};

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to start or join your meetings."
    >
      <LoginForm />
    </AuthLayout>
  );
}
