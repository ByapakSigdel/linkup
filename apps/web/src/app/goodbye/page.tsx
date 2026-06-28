'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

/**
 * A calm farewell shown after an account is wound down. No data, no network —
 * the session is already cleared client-side (the refresh token is revoked
 * server-side). Just a gentle send-off back to the front door. Mirrors
 * mobile/src/app/goodbye.tsx.
 */
export default function GoodbyePage() {
  const router = useRouter();

  // Honor prefers-reduced-motion: skip the staggered entrance when set.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const anim = (delay: string) =>
    reduceMotion ? undefined : ({ animation: `lk-rise 700ms ease-out ${delay} both` } as const);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-8 text-center">
      <style>{`
        @keyframes lk-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes lk-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={reduceMotion ? undefined : { animation: 'lk-fade 900ms ease-out both' }}>
        <LinkupMark size={40} />
      </div>

      <h1
        className="mt-7 font-display text-3xl font-semibold text-text"
        style={anim('150ms')}
      >
        Take care of yourself.
      </h1>

      <p
        className={cn('mt-4 max-w-sm text-text-muted')}
        style={anim('320ms')}
      >
        Your account has been wound down. Thank you for the moments you shared
        here — the door stays open whenever you want to begin again.
      </p>

      <div className="mt-9 w-full max-w-xs" style={anim('520ms')}>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => router.replace('/login')}
        >
          Back to the start
        </Button>
      </div>
    </div>
  );
}
