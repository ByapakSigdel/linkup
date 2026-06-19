import Link from 'next/link';
import { Logo } from '@/components/brand/logo';
import { ConstellationSky } from '@/components/brand/constellation-sky';
import { ConstellationOfTwo } from '@/components/brand/constellation-of-two';

const mono = { fontFamily: 'var(--font-space-mono), ui-monospace, monospace' };
const serif = { fontFamily: 'var(--font-instrument), Georgia, serif' };

export default function HomePage() {
  return (
    <main className="lk-celestial-scope relative min-h-screen overflow-hidden text-text">
      <ConstellationSky />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        {/* Top bar */}
        <header className="flex items-center justify-between py-7">
          <Logo markSize={26} wordmarkClassName="text-base" />
          <Link
            href="/login"
            className="rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-focus"
            style={mono}
          >
            log in
          </Link>
        </header>

        {/* Hero */}
        <div className="grid flex-1 items-center gap-12 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          {/* Words */}
          <div className="order-last lg:order-first">
            <p
              className="lk-anim-rise mb-7 text-[0.7rem] uppercase tracking-[0.34em] text-accent/80"
              style={{ ...mono, animationDelay: '0.1s' }}
            >
              made for the hours between midnight &amp; dawn
            </p>

            <h1
              className="text-balance text-5xl leading-[0.98] tracking-tight text-text sm:text-6xl lg:text-7xl"
              style={serif}
            >
              <span className="lk-anim-rise block" style={{ animationDelay: '0.2s' }}>
                A constellation
              </span>
              <span className="lk-anim-rise block" style={{ animationDelay: '0.35s' }}>
                of{' '}
                <em className="italic text-primary" style={serif}>
                  two
                </em>
                .
              </span>
            </h1>

            <p
              className="lk-anim-rise mt-7 max-w-md text-[1.05rem] leading-relaxed text-text-muted"
              style={{ animationDelay: '0.5s' }}
            >
              A private sky for you and the one you orbit. Chat, create, and keep
              every moment between the two of you — and no one else.
            </p>

            <div
              className="lk-anim-rise mt-10 flex flex-wrap items-center gap-4"
              style={{ animationDelay: '0.65s' }}
            >
              <Link
                href="/register"
                className="group inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-medium tracking-wide text-text-on-primary shadow-[0_10px_30px_-16px_rgba(196,168,224,0.5)] transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_14px_32px_-14px_rgba(196,168,224,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Begin your sky
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center border-b border-border-strong px-1 text-sm text-text transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:text-primary"
              >
                I already have one
              </Link>
            </div>
          </div>

          {/* Constellation */}
          <div className="lk-anim-fade order-first mx-auto w-full max-w-sm lg:order-last lg:max-w-none">
            <ConstellationOfTwo />
          </div>
        </div>

        {/* Ephemeris strip — the product's positioning as star-chart data. */}
        <footer
          className="lk-anim-fade flex flex-col gap-2 border-t border-border/60 py-6 text-[0.65rem] uppercase tracking-[0.26em] text-text-muted sm:flex-row sm:items-center sm:justify-between"
          style={{ ...mono, animationDelay: '1.1s' }}
        >
          <span>two stars · one bond</span>
          <span className="hidden sm:inline">no group chats · just the two of you</span>
          <span>linkup © {new Date().getFullYear()}</span>
        </footer>
      </div>
    </main>
  );
}
