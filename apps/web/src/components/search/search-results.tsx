'use client';

import Link from 'next/link';
import {
  MessageCircle,
  Image as ImageIcon,
  Calendar,
  Smile,
  Music,
} from 'lucide-react';
import { Card } from '@/components/ui';

export interface MessageResult {
  id: string;
  content: string;
  createdAt: string;
  type: 'message';
}
export interface MediaResult {
  id: string;
  caption: string | null;
  cdnUrl: string;
  mediaType: string;
  type: 'media';
}
export interface DateResult {
  id: string;
  title: string;
  date: string;
  type: 'date';
}
export interface EmojiResult {
  id: string;
  name: string;
  imageUrl: string;
  type: 'emoji';
}
export interface PlaylistResult {
  id: string;
  name: string;
  type: 'playlist';
}

export interface SearchResults {
  messages: MessageResult[];
  media: MediaResult[];
  dates: DateResult[];
  emojis: EmojiResult[];
  playlists: PlaylistResult[];
}

function GroupHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof MessageCircle;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="h-4 w-4 text-accent" />
      <h2 className="text-sm font-semibold text-text">{label}</h2>
      <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-text-muted">
        {count}
      </span>
    </div>
  );
}

function ResultRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="block">
      <Card
        cardStyle="bordered"
        padding="sm"
        className="flex items-center gap-3 hover:border-border-focus hover:bg-surface-hover"
      >
        {children}
      </Card>
    </Link>
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SearchResultsView({ results }: { results: SearchResults }) {
  return (
    <div className="space-y-8">
      {/* Messages */}
      {results.messages.length > 0 && (
        <section className="space-y-2.5">
          <GroupHeader
            icon={MessageCircle}
            label="Messages"
            count={results.messages.length}
          />
          <div className="space-y-2">
            {results.messages.map((m) => (
              <ResultRow key={m.id} href="/chat">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text">{m.content}</p>
                  <p className="text-xs text-text-muted">
                    {formatDate(m.createdAt)}
                  </p>
                </div>
              </ResultRow>
            ))}
          </div>
        </section>
      )}

      {/* Media */}
      {results.media.length > 0 && (
        <section className="space-y-2.5">
          <GroupHeader
            icon={ImageIcon}
            label="Media"
            count={results.media.length}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {results.media.map((item) => (
              <Link key={item.id} href="/gallery" className="group block">
                <div className="overflow-hidden rounded-xl border border-border bg-surface-hover transition-colors group-hover:border-border-focus">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.cdnUrl}
                    alt={item.caption ?? 'Media'}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                  {item.caption && (
                    <p className="truncate px-2 py-1.5 text-xs text-text-muted">
                      {item.caption}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Dates */}
      {results.dates.length > 0 && (
        <section className="space-y-2.5">
          <GroupHeader
            icon={Calendar}
            label="Dates"
            count={results.dates.length}
          />
          <div className="space-y-2">
            {results.dates.map((d) => (
              <ResultRow key={d.id} href="/dashboard">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                  <Calendar className="h-4 w-4 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {d.title}
                  </p>
                  <p className="text-xs text-text-muted">{formatDate(d.date)}</p>
                </div>
              </ResultRow>
            ))}
          </div>
        </section>
      )}

      {/* Emojis */}
      {results.emojis.length > 0 && (
        <section className="space-y-2.5">
          <GroupHeader
            icon={Smile}
            label="Emojis"
            count={results.emojis.length}
          />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {results.emojis.map((e) => (
              <Link key={e.id} href="/emojis" className="group block">
                <Card
                  cardStyle="bordered"
                  padding="sm"
                  className="flex flex-col items-center gap-2 hover:border-border-focus hover:bg-surface-hover"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={e.imageUrl}
                    alt={e.name}
                    loading="lazy"
                    className="h-12 w-12 object-contain"
                  />
                  <span className="w-full truncate text-center text-xs text-text-muted">
                    {e.name}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Playlists */}
      {results.playlists.length > 0 && (
        <section className="space-y-2.5">
          <GroupHeader
            icon={Music}
            label="Playlists"
            count={results.playlists.length}
          />
          <div className="space-y-2">
            {results.playlists.map((p) => (
              <ResultRow key={p.id} href="/music">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                  <Music className="h-4 w-4 text-accent" />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                  {p.name}
                </p>
              </ResultRow>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function searchTotalCount(results: SearchResults): number {
  return (
    results.messages.length +
    results.media.length +
    results.dates.length +
    results.emojis.length +
    results.playlists.length
  );
}

export const EMPTY_RESULTS: SearchResults = {
  messages: [],
  media: [],
  dates: [],
  emojis: [],
  playlists: [],
};
