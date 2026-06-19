'use client';

import { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useThemeStore } from '@/stores/theme-store';
import { themes, themeIds } from '@/styles/themes/index';

function ThemePreview({
  swatch,
  previewFont,
}: {
  swatch: [string, string, string, string, string];
  previewFont: string;
}) {
  const [bg, surface, primary, secondary, accent] = swatch;
  return (
    <div
      className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-black/20"
      style={{ background: bg }}
    >
      <span
        className="absolute h-2 w-2 rounded-full"
        style={{ background: secondary, top: 8, left: 8 }}
      />
      <span
        className="absolute h-1.5 w-1.5 rounded-full"
        style={{ background: accent, top: 30, left: 34 }}
      />
      <span
        className="absolute h-[3px] w-[3px] rotate-45"
        style={{ background: primary, top: 17, left: 22 }}
      />
      <div
        className="absolute inset-x-1.5 bottom-1.5 h-3 rounded"
        style={{ background: surface }}
      >
        <span
          className="absolute left-1 top-0.5 text-[7px] font-semibold leading-none"
          style={{ color: primary, fontFamily: previewFont }}
        >
          Aa
        </span>
      </div>
    </div>
  );
}

export function ThemeSelector() {
  const currentThemeId = useThemeStore((s) => s.currentThemeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const currentTheme = themes[currentThemeId] ?? themes['default']!;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-[var(--lk-btn-radius)] px-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        aria-label="Change theme"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Palette className="h-4 w-4" />
        <span className="hidden max-w-[8rem] truncate sm:inline">
          {currentTheme.name}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-2xl">
          <p className="px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Choose your sky
          </p>

          <div className="space-y-1">
            {themeIds.map((id) => {
              const theme = themes[id];
              if (!theme) return null;
              const isSelected = id === currentThemeId;

              return (
                <button
                  key={id}
                  onClick={() => {
                    setTheme(id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors',
                    isSelected ? 'bg-primary-light' : 'hover:bg-surface-hover',
                  )}
                >
                  <ThemePreview
                    swatch={theme.swatch}
                    previewFont={theme.previewFont}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm font-semibold',
                        isSelected ? 'text-primary' : 'text-text',
                      )}
                    >
                      {theme.name}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {theme.tagline}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
