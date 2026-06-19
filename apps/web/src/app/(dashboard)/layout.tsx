'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { MobileNav } from '@/components/layout/mobile-nav';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

        {/* Main content area */}
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)} />

          <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
            {children}
          </main>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </RealtimeProvider>
  );
}
