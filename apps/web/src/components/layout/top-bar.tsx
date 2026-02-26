'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Menu,
  Bell,
  LogOut,
  Settings,
  User,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, Badge } from '@/components/ui';
import { ThemeSelector } from '@/components/layout/theme-selector';

interface TopBarProps {
  onToggleSidebar: () => void;
}

/** Map route segments to page titles. */
const pageTitles: Record<string, string> = {
  chat: 'Chat',
  gallery: 'Gallery',
  scribble: 'Scribble',
  paint: 'Paint',
  streaks: 'Streaks',
  'hall-of-fame': 'Hall of Fame',
  circles: 'Circles',
  friends: 'Friends',
  profile: 'Profile',
  settings: 'Settings',
};

function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const key = segments[0] ?? '';
  return pageTitles[key] ?? 'Dashboard';
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  const logout = useAuthStore((s) => s.logout);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pageTitle = getPageTitle(pathname);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-surface/80 px-4 backdrop-blur-md lg:px-6">
      {/* Mobile menu toggle */}
      <button
        onClick={onToggleSidebar}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text lg:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-text truncate">
          {pageTitle}
        </h1>
        {couple?.coupleName && (
          <p className="text-xs text-text-muted truncate hidden sm:block">
            {couple.coupleName}
          </p>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Theme selector */}
        <ThemeSelector />

        {/* Notifications */}
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {/* Notification badge */}
          <Badge
            variant="error"
            size="sm"
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]"
          >
            3
          </Badge>
        </button>

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-hover"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <Avatar
              src={user?.avatarUrl}
              name={user?.displayName}
              size="sm"
              status={user?.isOnline ? 'online' : 'offline'}
            />
            <span className="hidden text-sm font-medium text-text sm:block max-w-[8rem] truncate">
              {user?.displayName}
            </span>
            <ChevronDown
              className={cn(
                'hidden h-4 w-4 text-text-muted transition-transform sm:block',
                userMenuOpen && 'rotate-180',
              )}
            />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg border border-border bg-surface shadow-lg">
              {/* User info header */}
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-medium text-text truncate">
                  {user?.displayName}
                </p>
                <p className="text-xs text-text-muted truncate">
                  {user?.email}
                </p>
              </div>

              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-text transition-colors hover:bg-surface-hover"
                >
                  <User className="h-4 w-4 text-text-muted" />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm text-text transition-colors hover:bg-surface-hover"
                >
                  <Settings className="h-4 w-4 text-text-muted" />
                  Settings
                </Link>
              </div>

              <div className="border-t border-border py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-error transition-colors hover:bg-surface-hover"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
