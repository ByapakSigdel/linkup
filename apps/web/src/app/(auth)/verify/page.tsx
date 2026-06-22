'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { AuthFormWrapper } from '@/components/layout/auth-form-wrapper';
import { cn } from '@/lib/cn';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { AxiosError } from 'axios';

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyPage() {
  const router = useRouter();
  const email = useAuthStore((s) => s.user?.email);

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/auth/verify/resend', { email });
      setSuccess('A new verification code has been sent to your email.');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(
        axiosError.response?.data?.message ||
          'Failed to resend code. Please try again.',
      );
    } finally {
      setIsResending(false);
    }
  }, [cooldown, isResending]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    if (!email) {
      setError('Your session expired. Please log in or sign up again.');
      return;
    }

    setIsVerifying(true);

    try {
      await api.post('/auth/verify', { email, code: trimmed });
      router.push('/chat');
    } catch (err) {
      const axiosError = err as AxiosError<{ message?: string }>;
      setError(
        axiosError.response?.data?.message ||
          'Invalid or expired code. Please try again.',
      );
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <AuthFormWrapper
      eyebrow="verify email"
      title="Check your email"
      description="We sent a 6-digit verification code to your email address"
    >
      {/* Email icon illustration */}
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-10 w-10 text-primary" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && (
          <div
            className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
            role="status"
          >
            {success}
          </div>
        )}

        <Input
          label="Verification Code"
          type="text"
          inputMode="numeric"
          placeholder="000000"
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => {
            // Only allow digits
            const val = e.target.value.replace(/\D/g, '');
            setCode(val);
          }}
          helperText="Enter the 6-digit code from your email"
          disabled={isVerifying}
          className="text-center text-lg tracking-[0.5em]"
        />

        <Button
          type="submit"
          loading={isVerifying}
          className="w-full"
          size="lg"
          disabled={code.length !== 6}
        >
          Verify Email
        </Button>

        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-text-muted">
            Didn&apos;t receive the code?
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            loading={isResending}
            disabled={cooldown > 0}
          >
            {cooldown > 0
              ? `Resend code in ${cooldown}s`
              : 'Resend code'}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex justify-center">
        <Link
          href="/login"
          className={cn(
            'inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text',
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>
    </AuthFormWrapper>
  );
}
