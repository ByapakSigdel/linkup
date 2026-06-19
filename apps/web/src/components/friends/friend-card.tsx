'use client';

import { useState } from 'react';
import { Settings2, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { Card, Button, Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import {
  PERMISSION_FIELDS,
  DEFAULT_PERMISSIONS,
  type Friend,
  type FriendPermissions,
} from './types';

interface FriendCardProps {
  friend: Friend;
  onChanged: () => void;
}

export function FriendCard({ friend, onChanged }: FriendCardProps) {
  const [managing, setManaging] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [perms, setPerms] = useState<FriendPermissions>({
    ...DEFAULT_PERMISSIONS,
    ...(friend.permissions ?? {}),
  });

  const user = friend.friendUser;
  const couple = friend.friendCouple;

  const displayName =
    user?.displayName ?? couple?.coupleName ?? 'LinkUp friend';
  const subtitle = user?.username
    ? `@${user.username}`
    : couple?.coupleName
      ? 'Couple'
      : undefined;
  const avatarSrc = user?.avatarUrl ?? couple?.coupleAvatarUrl ?? undefined;
  const isOnline = !!user?.isOnline;

  // Only the owning couple may edit permissions (backend enforces this too).
  const canManage = friend.isOwner !== false;

  const toggle = (key: keyof FriendPermissions) =>
    setPerms((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/friends/${friend.id}`, { permissions: perms });
      useToastStore.getState().push({
        title: 'Permissions updated',
        body: `Updated what ${displayName} can see.`,
        variant: 'success',
      });
      setManaging(false);
      onChanged();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Could not update permissions.';
      useToastStore.getState().push({
        title: 'Update failed',
        body: message,
        variant: 'info',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await api.delete(`/friends/${friend.id}`);
      useToastStore.getState().push({
        title: 'Friend removed',
        body: `${displayName} is no longer a friend.`,
        variant: 'success',
      });
      onChanged();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Could not remove friend.';
      useToastStore.getState().push({
        title: 'Remove failed',
        body: message,
        variant: 'info',
      });
      setRemoving(false);
      setConfirmingRemove(false);
    }
  };

  return (
    <Card cardStyle="bordered" padding="md" className="overflow-hidden">
      <div className="flex items-center gap-3">
        <Avatar
          src={avatarSrc}
          name={displayName}
          size="lg"
          status={user ? (isOnline ? 'online' : 'offline') : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-text">{displayName}</p>
            {isOnline && (
              <Badge variant="success" size="sm">
                Online
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="truncate text-sm text-text-muted">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {!confirmingRemove && (
        <div className="mt-4 flex items-center gap-2">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManaging((m) => !m)}
              className="flex-1"
            >
              <Settings2 className="h-4 w-4" />
              Manage
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingRemove(true)}
            className={cn('text-error hover:bg-error/10', !canManage && 'flex-1')}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      )}

      {/* Remove confirmation */}
      {confirmingRemove && (
        <div className="mt-4 rounded-lg border border-error/30 bg-error/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            <p className="text-sm text-text">
              Remove <span className="font-medium">{displayName}</span> from your
              friends?
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              loading={removing}
              onClick={handleRemove}
              className="flex-1"
            >
              Remove
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={removing}
              onClick={() => setConfirmingRemove(false)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Permissions editor */}
      {managing && canManage && !confirmingRemove && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface-hover p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            What {displayName} can see
          </p>
          <div className="space-y-1.5">
            {PERMISSION_FIELDS.map((field) => {
              const active = perms[field.key];
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => toggle(field.key)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                    active
                      ? 'border-primary/30 bg-primary-light'
                      : 'border-border bg-surface hover:bg-surface-hover',
                  )}
                >
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-sm font-medium',
                        active ? 'text-primary' : 'text-text',
                      )}
                    >
                      {field.label}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {field.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                      active
                        ? 'border-primary bg-primary text-text-on-primary'
                        : 'border-border-strong text-transparent',
                    )}
                    aria-hidden="true"
                  >
                    {active ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              loading={saving}
              onClick={handleSave}
              className="flex-1"
            >
              Save changes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setManaging(false);
                setPerms({
                  ...DEFAULT_PERMISSIONS,
                  ...(friend.permissions ?? {}),
                });
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
