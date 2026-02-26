'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { loginSchema } from '@linkup/validation';
import { useAuthStore } from '@/stores/auth-store';
import { Button, Input } from '@/components/ui';
import { AuthFormWrapper } from '@/components/layout/auth-form-wrapper';
import { cn } from '@/lib/cn';
import type { AxiosError } from 'axios';

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');

  function clearErrors() {
    setFieldErrors({});
    setApiError('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearErrors();

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    try {
      await login(result.data.email, result.data.password);
      router.push('/chat');
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      const message =
        axiosError.response?.data?.message ||
        'Invalid email or password. Please try again.';
      setApiError(message);
    }
  }

  return (
    <AuthFormWrapper
      title="Welcome back"
      description="Log in to continue to LinkUp"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {apiError && (
          <div
            className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
            role="alert"
          >
            {apiError}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          disabled={isLoading}
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={cn(
              'absolute right-3 top-[34px] text-text-muted transition-colors hover:text-text',
              fieldErrors.password && 'top-[34px]',
            )}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          loading={isLoading}
          className="mt-2 w-full"
          size="lg"
        >
          Log In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthFormWrapper>
  );
}
