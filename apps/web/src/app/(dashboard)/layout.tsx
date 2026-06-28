'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, isMemorialPending } from '@/stores/auth-store';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { RealtimeProvider } from '@/components/realtime/realtime-provider';
import { Spinner } from '@/components/ui';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hydrate = useAuthStore((s) => s.hydrate);
  // Subscribe reactively so a `couple:ended` refresh re-gates on the next render.
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Refresh user + couple on each dashboard mount so pairing/profile changes
  // made elsewhere (or by the partner) are reflected.
  useEffect(() => {
    if (isAuthenticated) {
      hydrate();
    }
  }, [isAuthenticated, hydrate]);

  useEffect(() => {
    if (mounted && !isAuthenticated && !isLoading) {
      router.replace('/login');
    }
  }, [mounted, isAuthenticated, isLoading, router]);

  // Survivor of an ended relationship who hasn't yet chosen → memorial takeover.
  // Guard against redirecting away from the memorial page itself (it lives inside
  // this dashboard group), which would otherwise loop.
  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    if (pathname === '/memorial' || pathname.startsWith('/memorial/')) return;
    if (isMemorialPending({ user, couple })) {
      router.replace('/memorial');
    }
  }, [mounted, isAuthenticated, user, couple, pathname, router]);

  // Show loading state while hydrating or checking auth
  if (!mounted || (!isAuthenticated && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (redirect is in progress)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <RealtimeProvider>
      <div className="flex min-h-screen bg-background">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          />
        </div>

        {/* Mobile drawer — the SAME sidebar, opened by the hamburger */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm lk-anim-fade"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 shadow-2xl">
              <Sidebar
                collapsed={false}
                onToggleCollapse={() => {}}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar onToggleSidebar={() => setMobileNavOpen(true)} />

          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
