'use client';

import { useState } from 'react';
import { ListMusic, Plus, Music2 } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { PlaylistSummary } from './types';

interface PlaylistListProps {
  playlists: PlaylistSummary[];
  selectedId: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string, description: string) => Promise<void> | void;
}

export function PlaylistList({
  playlists,
  selectedId,
  loading,
  creating,
  onSelect,
  onCreate,
}: PlaylistListProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim(), description.trim());
    setName('');
    setDescription('');
    setShowForm(false);
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ListMusic className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-text">Playlists</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          shape="pill"
          onClick={() => setShowForm((s) => !s)}
          aria-expanded={showForm}
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-2 border-b border-border bg-surface-hover/50 p-3"
        >
          <Input
            placeholder="Playlist name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={80}
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={creating}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </div>
        </form>
      )}

      <div className="max-h-[60vh] min-h-[8rem] flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : playlists.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-text-muted">
            No playlists yet. Create one to start curating songs together.
          </div>
        ) : (
          <ul className="space-y-1">
            {playlists.map((pl) => {
              const isActive = pl.id === selectedId;
              return (
                <li key={pl.id}>
                  <button
                    onClick={() => onSelect(pl.id)}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-primary text-text-on-primary'
                        : 'text-text hover:bg-surface-hover',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg',
                        isActive ? 'bg-white/15' : 'bg-primary-light',
                      )}
                    >
                      {pl.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pl.coverUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Music2
                          className={cn(
                            'h-4 w-4',
                            isActive ? 'text-text-on-primary' : 'text-primary',
                          )}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{pl.name}</p>
                      <p
                        className={cn(
                          'truncate text-xs',
                          isActive
                            ? 'text-text-on-primary/75'
                            : 'text-text-muted',
                        )}
                      >
                        {pl.trackCount} {pl.trackCount === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
