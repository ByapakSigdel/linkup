'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  MessageCircle,
  Image,
  Pencil,
  Palette,
  Flame,
  Trophy,
  Users,
  UserPlus,
  Settings,
  Heart,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/gallery', label: 'Gallery', icon: Image },
  { href: '/scribble', label: 'Scribble', icon: Pencil },
  { href: '/paint', label: 'Paint', icon: Palette },
  { href: '/streaks', label: 'Streaks', icon: Flame },
  { href: '/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
  { href: '/circles', label: 'Circles', icon: Users },
  { href: '/friends', label: 'Friends', icon: UserPlus },
] as const;

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r border-border bg-surface transition-all duration-300',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Heart className="h-5 w-5 text-text-on-primary" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-text tracking-tight">
            LinkUp
          </span>
        )}
      </div>

      {/* Couple status */}
      {couple?.isPaired && !collapsed && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-primary-light px-3 py-2">
          <Heart className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate text-xs font-medium text-primary">
            {couple.coupleName || 'Linked up'}
          </span>
        </div>
      )}
      {couple?.isPaired && collapsed && (
        <div className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary-light">
          <Heart className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-text-on-primary shadow-sm'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0 transition-colors',
                  isActive
                    ? 'text-text-on-primary'
                    : 'text-text-muted group-hover:text-text',
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border px-3 py-2">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Profile section */}
      <div className="border-t border-border px-3 py-3">
        <Link
          href="/profile"
          className={cn(
            'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-hover',
            collapsed && 'justify-center px-0',
          )}
        >
          <Avatar
            src={user?.avatarUrl}
            name={user?.displayName}
            size="sm"
            status={user?.isOnline ? 'online' : 'offline'}
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-text">
                {user?.displayName}
              </p>
              <p className="truncate text-xs text-text-muted">
                @{user?.username}
              </p>
            </div>
          )}
          {!collapsed && (
            <Settings className="h-4 w-4 shrink-0 text-text-muted" />
          )}
        </Link>
      </div>
    </aside>
  );
}
