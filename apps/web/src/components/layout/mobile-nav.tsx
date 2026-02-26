'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, MessageCircle, Image, Flame, User } from 'lucide-react';
import { cn } from '@/lib/cn';

const mobileNavItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/gallery', label: 'Gallery', icon: Image },
  { href: '/streaks', label: 'Streaks', icon: Flame },
  { href: '/profile', label: 'Profile', icon: User },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-text-muted hover:text-text',
              )}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  isActive && 'text-primary',
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isActive && 'font-semibold',
                )}
              >
                {item.label}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -bottom-0 h-0.5 w-5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Safe area padding for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
