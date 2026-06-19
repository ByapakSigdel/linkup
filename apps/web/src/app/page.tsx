import Link from 'next/link';
import { LinkupMark } from '@/components/brand/logo';

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Hero */}
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        {/* Logo lockup — constellation over wordmark */}
        <div className="mb-10 flex flex-col items-center gap-5">
          <LinkupMark size={72} />
          <h1 className="text-5xl font-light lowercase tracking-[0.35em] text-text sm:text-6xl">
            linkup
          </h1>
        </div>

        {/* Tagline */}
        <p className="mb-3 text-xl leading-relaxed text-text">
          Your private constellation of two.
        </p>
        <p className="mb-10 text-base leading-relaxed text-text-muted">
          A quiet space to connect, share moments, and grow together — built for
          couples who want something more meaningful than a group chat.
          <span className="mt-2 block text-sm italic text-text-muted/80">
            Made for the hours between midnight and dawn.
          </span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-base font-medium text-text-on-primary shadow-sm transition-all hover:bg-primary-hover"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-border-strong px-8 text-base font-medium text-text transition-all hover:bg-surface-hover"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-8 z-10 text-sm text-text-muted">
        Two stars, one bond. · linkup
      </footer>
    </div>
  );
}
