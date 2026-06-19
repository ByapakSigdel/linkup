'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, UserPlus, Users, Check } from 'lucide-react';
import { Card, Button, Input, Avatar, Spinner } from '@/components/ui';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import type { DiscoverUser } from './types';

interface DiscoverTabProps {
  /** True when the couple is already at the maximum number of friends. */
  atLimit: boolean;
  maxAllowed: number;
  /** Refetch friends/requests after a successful invite. */
  onInvited: () => void;
}

export function DiscoverTab({ atLimit, maxAllowed, onInvited }: DiscoverTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Track which usernames have been invited this session for UI feedback.
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await api.get('/friends/discover', {
          params: { q: term },
        });
        setResults(data.data.users ?? []);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [query]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInvite = async (user: DiscoverUser) => {
    if (atLimit) {
      useToastStore.getState().push({
        title: 'Friend limit reached',
        body: `You can have at most ${maxAllowed} friends. Remove one to add another.`,
        variant: 'info',
      });
      return;
    }
    setPending(user.username);
    try {
      await api.post('/friends/invite', { username: user.username });
      setInvited((prev) => new Set(prev).add(user.username));
      useToastStore.getState().push({
        title: 'Request sent',
        body: `Friend request sent to ${user.displayName}.`,
        variant: 'success',
      });
      onInvited();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Could not send the request.';
      useToastStore.getState().push({
        title: 'Request failed',
        body: message,
        variant: 'info',
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      {atLimit && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text">
          You have reached the maximum of {maxAllowed} friends. Remove a friend
          before adding a new one.
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          ref={inputRef}
          placeholder="Search by name or @username..."
          className="pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* States */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : query.trim().length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium text-text">Find your people</p>
          <p className="max-w-xs text-xs text-text-muted">
            Search for friends by their name or username to send a request.
          </p>
        </div>
      ) : searched && results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover">
            <Users className="h-6 w-6 text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text">No matches found</p>
          <p className="max-w-xs text-xs text-text-muted">
            Try a different name or username.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((user) => {
            const alreadyInvited = invited.has(user.username);
            return (
              <Card
                key={user.id}
                cardStyle="bordered"
                padding="sm"
                className="flex items-center gap-3"
              >
                <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text">
                    {user.displayName}
                  </p>
                  <p className="truncate text-sm text-text-muted">
                    @{user.username}
                  </p>
                </div>
                {alreadyInvited ? (
                  <Button variant="ghost" size="sm" disabled>
                    <Check className="h-4 w-4 text-success" />
                    Sent
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    loading={pending === user.username}
                    disabled={atLimit || pending !== null}
                    onClick={() => handleInvite(user)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Add friend
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
