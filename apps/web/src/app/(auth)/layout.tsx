import { Heart } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding / decorative (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center overflow-hidden bg-primary p-12">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--color-primary),var(--color-secondary))]" />

        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/4 h-64 w-64 -translate-y-1/2 rounded-full bg-white/[0.03]" />

        {/* Floating dots pattern */}
        <div className="absolute inset-0">
          <div className="absolute top-[15%] left-[20%] h-2 w-2 rounded-full bg-white/20" />
          <div className="absolute top-[30%] right-[25%] h-1.5 w-1.5 rounded-full bg-white/15" />
          <div className="absolute bottom-[25%] left-[35%] h-2.5 w-2.5 rounded-full bg-white/10" />
          <div className="absolute top-[60%] right-[15%] h-1.5 w-1.5 rounded-full bg-white/20" />
          <div className="absolute bottom-[40%] left-[15%] h-2 w-2 rounded-full bg-white/15" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center text-white">
          {/* Logo */}
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
            <Heart className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>

          <h1 className="text-5xl font-bold tracking-tight">LinkUp</h1>
          <p className="mt-4 max-w-sm text-lg text-white/80 leading-relaxed">
            Your shared space to connect, create, and celebrate your
            relationship every day.
          </p>

          {/* Feature pills */}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {['Chat', 'Gallery', 'Scribble', 'Streaks', 'Circles'].map(
              (feature) => (
                <span
                  key={feature}
                  className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm"
                >
                  {feature}
                </span>
              ),
            )}
          </div>
        </div>

        {/* Bottom attribution */}
        <p className="absolute bottom-8 text-xs text-white/40">
          Made with love for couples everywhere
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {/* Mobile logo (visible only on small screens) */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Heart className="h-5 w-5 text-text-on-primary" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-bold text-text">LinkUp</span>
        </div>

        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
