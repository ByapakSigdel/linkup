'use client';

import { useState } from 'react';
import { X, Lock, Globe } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import type { CircleListItem } from './types';

interface CreateCircleFormProps {
  onCreated: (circle: CircleListItem) => void;
  onCancel: () => void;
}

export function CreateCircleForm({ onCreated, onCancel }: CreateCircleFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [maxMembers, setMaxMembers] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please give your circle a name');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post('/circles', {
        name: trimmed,
        description: description.trim() || undefined,
        isPrivate,
        maxMembers,
      });
      const circle = data.data.circle;
      const item: CircleListItem = {
        id: circle.id,
        name: circle.name,
        description: circle.description ?? null,
        coverImageUrl: circle.coverImageUrl ?? null,
        memberCount: circle.memberCount ?? 1,
        postCount: circle.postCount ?? 0,
        isAdmin: true,
        inviteCode: circle.inviteCode ?? null,
      };
      useToastStore.getState().push({
        title: 'Circle created',
        body: `"${item.name}" is ready. Share the invite code to add couples.`,
      });
      onCreated(item);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Could not create the circle. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-text">
          Create a circle
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Circle name"
          placeholder="e.g. Weekend Adventurers"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="circle-description"
            className="text-sm font-medium text-text"
          >
            Description{' '}
            <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <textarea
            id="circle-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this circle about?"
            rows={3}
            maxLength={280}
            className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted transition-all focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
          />
        </div>

        {/* Privacy toggle */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Privacy</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPrivate(true)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                isPrivate
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border bg-transparent text-text-muted hover:bg-surface-hover',
              )}
            >
              <Lock className="h-4 w-4" />
              <span className="font-medium">Private</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrivate(false)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                !isPrivate
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border bg-transparent text-text-muted hover:bg-surface-hover',
              )}
            >
              <Globe className="h-4 w-4" />
              <span className="font-medium">Open</span>
            </button>
          </div>
          <p className="text-xs text-text-muted">
            {isPrivate
              ? 'Couples need the invite code to join.'
              : 'Any couple with the link can join.'}
          </p>
        </div>

        {/* Max members */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="circle-max-members"
              className="text-sm font-medium text-text"
            >
              Max member couples
            </label>
            <span className="font-mono text-sm font-semibold text-primary">
              {maxMembers}
            </span>
          </div>
          <input
            id="circle-max-members"
            type="range"
            min={2}
            max={10}
            step={1}
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-text-muted">
            <span>2</span>
            <span>10</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting}>
            Create circle
          </Button>
        </div>
      </form>
    </div>
  );
}
