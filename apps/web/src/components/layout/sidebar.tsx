'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home,
  MessageCircle,
  Image,
  Flame,
  Pencil,
  Palette,
  Smile,
  Volume2,
  Clapperboard,
  Music,
  Radio,
  Trophy,
  Users,
  UserPlus,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui';
import { LinkupMark, LinkupWordmark } from '@/components/brand/logo';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navSections = [
  {
    label: 'Everyday',
    items: [
      { href: '/dashboard', label: 'Home', icon: Home },
      { href: '/chat', label: 'Chat', icon: MessageCircle },
      { href: '/gallery', label: 'Gallery', icon: Image },
      { href: '/streaks', label: 'Streaks', icon: Flame },
    ],
  },
  {
    label: 'Studio',
    items: [
      { href: '/scribble', label: 'Scribble', icon: Pencil },
      { href: '/paint', label: 'Paint', icon: Palette },
      { href: '/emojis', label: 'Emojis', icon: Smile },
      { href: '/soundboard', label: 'SoundBoard', icon: Volume2 },
    ],
  },
  {
    label: 'Side by side',
    items: [
      { href: '/watch', label: 'Watch Party', icon: Clapperboard },
      { href: '/music', label: 'Music', icon: Music },
      { href: '/stream', label: 'Streaming', icon: Radio },
    ],
  },
  {
    label: 'Your circle',
    items: [
      { href: '/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
      { href: '/circles', label: 'Circles', icon: Users },
      { href: '/friends', label: 'Friends', icon: UserPlus },
    ],
  },
] as const;

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);

  return (
    <aside
      className={cn(
        'sticky top-0 z-20 flex h-screen flex-col border-r border-border bg-surface/70 backdrop-blur-xl transition-all duration-300',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <LinkupMark size={30} className="shrink-0" />
        {!collapsed && <LinkupWordmark className="text-base" />}
      </div>

      {/* Couple status */}
      {couple?.isPaired && (
        <div className={cn('px-3', collapsed && 'flex justify-center px-0')}>
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border border-border bg-primary-light px-3 py-1.5',
              collapsed && 'h-8 w-8 justify-center p-0',
            )}
          >
            <span className="lk-twinkle h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {!collapsed && (
              <span className="truncate text-xs font-medium text-primary">
                {couple.coupleName || 'Linked up'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {navSections.map((section, si) => (
          <div key={section.label}>
            {!collapsed ? (
              <p className="px-3 pb-2 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-text-muted/60">
                {section.label}
              </p>
            ) : (
              si > 0 && <div className="mx-3 mb-3 lk-hairline" />
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-[var(--lk-btn-radius)] px-3 py-2.5 text-sm transition-all',
                      isActive
                        ? 'bg-primary-light font-semibold text-primary'
                        : 'font-medium text-text-muted hover:bg-surface-hover hover:text-text',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    {/* active accent bar */}
                    {isActive && !collapsed && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        'h-[1.15rem] w-[1.15rem] shrink-0 transition-colors',
                        isActive
                          ? 'text-primary'
                          : 'text-text-muted group-hover:text-text',
                      )}
                      strokeWidth={isActive ? 2.4 : 1.9}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-2">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--lk-btn-radius)] px-3 py-2 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
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

      {/* Profile */}
      <div className="border-t border-border p-3">
        <Link
          href="/profile"
          className={cn(
            'flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-hover',
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
            <div className="min-w-0 flex-1">
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
