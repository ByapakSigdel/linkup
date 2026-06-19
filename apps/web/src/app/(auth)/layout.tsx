import Link from 'next/link';
import { ConstellationSky } from '@/components/brand/constellation-sky';
import { Logo } from '@/components/brand/logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lk-celestial-scope relative flex min-h-screen flex-col text-text">
      <ConstellationSky />

      {/* Brand returns home */}
      <header className="relative z-10 px-6 py-7">
        <Link
          href="/"
          className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-focus"
          aria-label="LinkUp home"
        >
          <Logo markSize={24} wordmarkClassName="text-sm" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
