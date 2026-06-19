'use client';

import { useState } from 'react';
import {
  Users,
  MessageSquare,
  Activity,
  Copy,
  Check,
  Pencil,
  Trash2,
  LogOut,
  X,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import type { CircleDetail, CircleStats } from './types';

interface CircleHeaderProps {
  circle: CircleDetail;
  stats: CircleStats;
  isAdmin: boolean;
  isCreator: boolean;
  onUpdated: (patch: Partial<CircleDetail>) => void;
  onDeleted: () => void;
  onLeft: () => void;
}

export function CircleHeader({
  circle,
  stats,
  isAdmin,
  isCreator,
  onUpdated,
  onDeleted,
  onLeft,
}: CircleHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(circle.name);
  const [description, setDescription] = useState(circle.description ?? '');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const initial = circle.name?.trim()?.charAt(0)?.toUpperCase() || '?';

  const handleCopyInvite = async () => {
    if (!circle.inviteCode) return;
    const token = `${circle.id}:${circle.inviteCode}`;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      useToastStore.getState().push({
        title: 'Invite copied',
        body: 'Share it with a couple so they can join.',
      });
    } catch {
      useToastStore.getState().push({
        title: 'Copy failed',
        body: token,
      });
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await api.patch(`/circles/${circle.id}`, {
        name: trimmed,
        description: description.trim(),
      });
      onUpdated({ name: trimmed, description: description.trim() });
      setEditing(false);
      useToastStore.getState().push({ title: 'Circle updated' });
    } catch (err: any) {
      useToastStore.getState().push({
        title: 'Update failed',
        body:
          err.response?.data?.error?.message ||
          'Could not save changes. Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete "${circle.name}"? This removes the circle and all its posts for everyone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api.delete(`/circles/${circle.id}`);
      useToastStore.getState().push({ title: 'Circle deleted' });
      onDeleted();
    } catch (err: any) {
      setBusy(false);
      useToastStore.getState().push({
        title: 'Delete failed',
        body:
          err.response?.data?.error?.message ||
          'Could not delete the circle. Try again.',
      });
    }
  };

  const handleLeave = async () => {
    if (!window.confirm(`Leave "${circle.name}"?`)) return;
    setBusy(true);
    try {
      await api.delete(`/circles/${circle.id}/leave`);
      useToastStore.getState().push({ title: 'Left circle' });
      onLeft();
    } catch (err: any) {
      setBusy(false);
      useToastStore.getState().push({
        title: 'Could not leave',
        body:
          err.response?.data?.error?.message ||
          'Something went wrong. Try again.',
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {/* Cover */}
      <div className="relative h-32 w-full overflow-hidden bg-primary-light sm:h-40">
        {circle.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={circle.coverImageUrl}
            alt={circle.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-6xl font-bold text-primary/60">
              {initial}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {editing ? (
          <div className="space-y-3">
            <Input
              label="Circle name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edit-circle-desc"
                className="text-sm font-medium text-text"
              >
                Description
              </label>
              <textarea
                id="edit-circle-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={280}
                className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted transition-all focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setName(circle.name);
                  setDescription(circle.description ?? '');
                }}
                disabled={saving}
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                loading={saving}
                disabled={!name.trim()}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-bold text-text">
                  {circle.name}
                </h1>
                {circle.description && (
                  <p className="mt-1 text-sm text-text-muted">
                    {circle.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                {isCreator ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    loading={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLeave}
                    loading={busy}
                  >
                    <LogOut className="h-4 w-4" />
                    Leave
                  </Button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span className="font-mono">{stats.memberCount}</span> member
                {stats.memberCount !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                <span className="font-mono">{stats.postCount}</span> post
                {stats.postCount !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 text-primary">
                <Activity className="h-4 w-4" />
                <span className="font-mono">{stats.activityScore}</span> activity
              </span>
            </div>

            {/* Invite code */}
            {circle.inviteCode && (
              <div className="flex items-center gap-2 rounded-lg bg-surface-hover p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-muted">
                    Invite (share to add a couple)
                  </p>
                  <p className="truncate font-mono text-sm text-text">
                    {circle.id}:{circle.inviteCode}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInvite}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
