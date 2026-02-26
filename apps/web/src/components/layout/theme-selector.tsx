'use client';

import { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useThemeStore } from '@/stores/theme-store';
import { themes, themeIds } from '@/styles/themes/index';

/** The primary / secondary / accent colours for each theme, used for swatch previews. */
const themeSwatches: Record<string, [string, string, string]> = {
  default: ['#F43F5E', '#A855F7', '#F59E0B'],
  dreamy: ['#7C3AED', '#EC4899', '#F0ABFC'],
  botanical: ['#16A34A', '#E11D48', '#CA8A04'],
  midnight: ['#8B5CF6', '#06B6D4', '#F472B6'],
  minimal: ['#18181B', '#71717A', '#3B82F6'],
};

export function ThemeSelector() {
  const currentThemeId = useThemeStore((s) => s.currentThemeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const currentTheme = (themes[currentThemeId] ?? themes['default'])!;

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        aria-label="Change theme"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Palette className="h-4 w-4" />
        <span className="hidden sm:inline">{currentTheme.name}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl border border-border bg-surface p-2 shadow-lg">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Theme
          </p>

          <div className="space-y-0.5">
            {themeIds.map((id) => {
              const theme = themes[id];
              if (!theme) return null;
              const isSelected = id === currentThemeId;
              const swatches = themeSwatches[id] ?? ['#888', '#888', '#888'];

              return (
                <button
                  key={id}
                  onClick={() => {
                    setTheme(id);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'bg-primary-light'
                      : 'hover:bg-surface-hover',
                  )}
                >
                  {/* Colour swatches */}
                  <div className="flex -space-x-1">
                    {swatches.map((color, i) => (
                      <span
                        key={i}
                        className="inline-block h-5 w-5 rounded-full border-2 border-surface shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-primary' : 'text-text',
                      )}
                    >
                      {theme.name}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {theme.description}
                    </p>
                  </div>

                  {/* Check mark */}
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
