import Link from 'next/link';
import { Heart } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="mx-auto max-w-2xl text-center">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Heart className="h-7 w-7 text-white" fill="currentColor" />
          </div>
          <h1
            className="text-5xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            LinkUp
          </h1>
        </div>

        {/* Tagline */}
        <p
          className="mb-10 text-xl leading-relaxed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Your private space to connect, share moments, and grow together.
          Built for couples who want something more meaningful than a group
          chat.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-xl px-8 text-base font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'var(--gradient-primary)' }}
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-xl border px-8 text-base font-semibold transition-all hover:opacity-80"
            style={{
              borderColor: 'var(--color-border-strong)',
              color: 'var(--color-text)',
            }}
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="absolute bottom-8 text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Made with{' '}
        <Heart
          className="inline h-4 w-4"
          style={{ color: 'var(--color-primary)' }}
          fill="currentColor"
        />{' '}
        for couples everywhere
      </footer>
    </div>
  );
}
