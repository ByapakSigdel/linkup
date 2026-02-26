'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Eye,
  Palette,
  Shield,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Type,
  Accessibility,
  Download,
  MessageCircle,
  Phone,
  Flame,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Spinner,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import api from '@/lib/api';

interface UserSettings {
  id: string;
  userId: string;
  themeId: string;
  pushNotifications: boolean;
  messageNotifications: boolean;
  callNotifications: boolean;
  streakReminders: boolean;
  anniversaryReminders: boolean;
  showOnlineStatus: boolean;
  showReadReceipts: boolean;
  showTypingIndicator: boolean;
  autoDownloadMedia: boolean;
  mediaQuality: string;
  fontSize: string;
  reduceMotion: boolean;
  highContrast: boolean;
}

const THEMES = [
  { id: 'default', name: 'Default', desc: 'Warm & clean' },
  { id: 'dreamy', name: 'Dreamy', desc: 'Whimsical & playful' },
  { id: 'botanical', name: 'Botanical', desc: 'Earthy & bold' },
  { id: 'midnight', name: 'Midnight', desc: 'Dark & moody' },
  { id: 'minimal', name: 'Minimal', desc: 'Ultra-clean' },
] as const;

function Toggle({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {Icon && (
          <Icon className="h-5 w-5 shrink-0 text-text-muted" />
        )}
        <div>
          <p className="text-sm font-medium text-text">{label}</p>
          {description && (
            <p className="text-xs text-text-muted">{description}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-surface-hover',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-surface shadow-md transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
            'mt-0.5',
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { currentThemeId, setTheme } = useThemeStore();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/users/me/settings');
      setSettings(data.data.settings);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = useCallback(
    async (key: keyof UserSettings, value: boolean | string) => {
      if (!settings) return;
      setSettings({ ...settings, [key]: value });
      setIsSaving(true);
      try {
        await api.patch('/users/me/settings', { [key]: value });
      } catch {
        // Revert on failure
        setSettings(settings);
      } finally {
        setIsSaving(false);
      }
    },
    [settings],
  );

  const handleThemeChange = useCallback(
    async (themeId: string) => {
      setTheme(themeId);
      if (settings) {
        setSettings({ ...settings, themeId });
        try {
          await api.patch('/users/me/settings', { themeId });
        } catch {
          // Theme is already applied locally
        }
      }
    },
    [settings, setTheme],
  );

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Settings</h1>
        <p className="text-text-muted">
          Customize your LinkUp experience
        </p>
      </div>

      {/* Theme */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={cn(
                  'rounded-xl border-2 p-3 text-left transition-all',
                  currentThemeId === t.id
                    ? 'border-primary bg-primary-light shadow-sm'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <p className="text-sm font-semibold text-text">{t.name}</p>
                <p className="text-xs text-text-muted">{t.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            <Toggle
              checked={settings?.pushNotifications ?? true}
              onChange={(val) => updateSetting('pushNotifications', val)}
              label="Push Notifications"
              description="Receive push notifications on your device"
              icon={Bell}
            />
            <Toggle
              checked={settings?.messageNotifications ?? true}
              onChange={(val) => updateSetting('messageNotifications', val)}
              label="Message Notifications"
              description="Get notified when you receive a message"
              icon={MessageCircle}
            />
            <Toggle
              checked={settings?.callNotifications ?? true}
              onChange={(val) => updateSetting('callNotifications', val)}
              label="Call Notifications"
              description="Get notified for incoming calls"
              icon={Phone}
            />
            <Toggle
              checked={settings?.streakReminders ?? true}
              onChange={(val) => updateSetting('streakReminders', val)}
              label="Streak Reminders"
              description="Remind me to keep my streak going"
              icon={Flame}
            />
            <Toggle
              checked={settings?.anniversaryReminders ?? true}
              onChange={(val) => updateSetting('anniversaryReminders', val)}
              label="Anniversary Reminders"
              description="Remind me of upcoming important dates"
              icon={Calendar}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            <Toggle
              checked={settings?.showOnlineStatus ?? true}
              onChange={(val) => updateSetting('showOnlineStatus', val)}
              label="Show Online Status"
              description="Let your partner see when you're online"
              icon={Eye}
            />
            <Toggle
              checked={settings?.showReadReceipts ?? true}
              onChange={(val) => updateSetting('showReadReceipts', val)}
              label="Read Receipts"
              description="Show when you've read messages"
              icon={Eye}
            />
            <Toggle
              checked={settings?.showTypingIndicator ?? true}
              onChange={(val) => updateSetting('showTypingIndicator', val)}
              label="Typing Indicator"
              description="Show when you're typing a message"
              icon={MessageCircle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Media & Data */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Media & Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            <Toggle
              checked={settings?.autoDownloadMedia ?? true}
              onChange={(val) => updateSetting('autoDownloadMedia', val)}
              label="Auto-Download Media"
              description="Automatically download shared photos and videos"
              icon={Download}
            />
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Monitor className="h-5 w-5 shrink-0 text-text-muted" />
                <div>
                  <p className="text-sm font-medium text-text">
                    Media Quality
                  </p>
                  <p className="text-xs text-text-muted">
                    Quality of uploaded media
                  </p>
                </div>
              </div>
              <select
                value={settings?.mediaQuality ?? 'high'}
                onChange={(e) =>
                  updateSetting('mediaQuality', e.target.value)
                }
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="original">Original</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Accessibility className="h-5 w-5" />
            Accessibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Type className="h-5 w-5 shrink-0 text-text-muted" />
                <div>
                  <p className="text-sm font-medium text-text">Font Size</p>
                  <p className="text-xs text-text-muted">
                    Adjust the text size
                  </p>
                </div>
              </div>
              <select
                value={settings?.fontSize ?? 'medium'}
                onChange={(e) =>
                  updateSetting('fontSize', e.target.value)
                }
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <Toggle
              checked={settings?.reduceMotion ?? false}
              onChange={(val) => updateSetting('reduceMotion', val)}
              label="Reduce Motion"
              description="Minimize animations and transitions"
            />
            <Toggle
              checked={settings?.highContrast ?? false}
              onChange={(val) => updateSetting('highContrast', val)}
              label="High Contrast"
              description="Increase contrast for better readability"
            />
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-error">
            <LogOut className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleLogout}
            variant="destructive"
            size="md"
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
