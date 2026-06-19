'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Check } from 'lucide-react';
import { registerSchema } from '@linkup/validation';
import { useAuthStore } from '@/stores/auth-store';
import { Button, Input } from '@/components/ui';
import { AuthFormWrapper } from '@/components/layout/auth-form-wrapper';
import { cn } from '@/lib/cn';
import type { AxiosError } from 'axios';

interface FieldErrors {
  email?: string;
  username?: string;
  displayName?: string;
  password?: string;
  confirmPassword?: string;
}

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

const strengthConfig: Record<
  PasswordStrength,
  { label: string; color: string; width: string }
> = {
  weak: { label: 'Weak', color: 'bg-error', width: 'w-1/3' },
  medium: { label: 'Medium', color: 'bg-warning', width: 'w-2/3' },
  strong: { label: 'Strong', color: 'bg-success', width: 'w-full' },
};

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');

  const passwordStrength = useMemo(
    () => getPasswordStrength(password),
    [password],
  );
  const strengthInfo = strengthConfig[passwordStrength];

  function clearErrors() {
    setFieldErrors({});
    setApiError('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearErrors();

    // Validate confirm password match first
    const errors: FieldErrors = {};
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Validate with schema
    const result = registerSchema.safeParse({
      email,
      username,
      displayName,
      password,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
    }

    if (!agreedToTerms) {
      setApiError('You must agree to the Terms of Service to continue.');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!agreedToTerms) {
      return;
    }

    try {
      await register({
        email: result.data!.email,
        username: result.data!.username,
        displayName: result.data!.displayName,
        password: result.data!.password,
      });
      router.push('/chat');
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      const message =
        axiosError.response?.data?.message ||
        'Registration failed. Please try again.';
      setApiError(message);
    }
  }

  return (
    <AuthFormWrapper
      eyebrow="new sky"
      title="Find your other star"
      description="Create your account, then link up with the one you orbit."
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

        <Input
          label="Username"
          type="text"
          placeholder="your_username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={fieldErrors.username}
          helperText="3-30 characters, letters, numbers, and underscores only"
          disabled={isLoading}
        />

        <Input
          label="Display Name"
          type="text"
          placeholder="Your Name"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors.displayName}
          disabled={isLoading}
        />

        {/* Password field */}
        <div>
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-text-muted transition-colors hover:text-text"
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

          {/* Password strength indicator */}
          {password.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    strengthInfo.color,
                    strengthInfo.width,
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  passwordStrength === 'weak' && 'text-error',
                  passwordStrength === 'medium' && 'text-warning',
                  passwordStrength === 'strong' && 'text-success',
                )}
              >
                {strengthInfo.label}
              </span>
            </div>
          )}
        </div>

        {/* Confirm Password field */}
        <div className="relative">
          <Input
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-[34px] text-text-muted transition-colors hover:text-text"
            tabIndex={-1}
            aria-label={
              showConfirmPassword ? 'Hide password' : 'Show password'
            }
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Terms checkbox */}
        <label className="flex cursor-pointer items-start gap-3">
          <div className="relative mt-0.5 flex items-center">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="peer sr-only"
              disabled={isLoading}
            />
            <div
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded border border-border transition-colors',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-border-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
                agreedToTerms && 'border-primary bg-primary',
              )}
            >
              {agreedToTerms && (
                <Check className="h-3 w-3 text-text-on-primary" />
              )}
            </div>
          </div>
          <span className="text-sm text-text-muted">
            I agree to the{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <Button
          type="submit"
          loading={isLoading}
          className="mt-2 w-full"
          size="lg"
        >
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-muted">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthFormWrapper>
  );
}
