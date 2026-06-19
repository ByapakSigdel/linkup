'use client';

import Link from 'next/link';
import { Gamepad2, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useGamesStore } from '@/stores/games-store';
import {
  GAMES,
  CATEGORY_LABELS,
  getGame,
  type GameCategory,
} from '@/components/games/registry';
import { Emoji } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';

const ORDER: GameCategory[] = ['classic', 'couple', 'creative', 'luck'];

export default function GamesPage() {
  const couple = useAuthStore((s) => s.couple);
  const partnerInGame = useGamesStore((s) => s.partnerInGame);
  const joinable = partnerInGame ? getGame(partnerInGame) : null;

  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <LinkupMark size={48} className="mb-4 opacity-90" />
        <h2 className="text-lg font-semibold text-text">Games for two</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Link up with your partner to play together — head-to-head classics,
          couple games, and more.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light">
          <Gamepad2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Games</h1>
          <p className="text-sm text-text-muted">Pick a game to play together</p>
        </div>
      </div>

      {joinable && (
        <Link
          href={`/games/${joinable.key}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-primary bg-primary-light p-4 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex items-center gap-3">
            <Emoji emoji={joinable.emoji} size={26} />
            <span>
              <span className="block text-sm font-semibold text-primary">
                Your partner is in {joinable.name}
              </span>
              <span className="block text-xs text-text-muted">Tap to join them</span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-primary" />
        </Link>
      )}

      {ORDER.map((cat) => {
        const games = GAMES.filter((g) => g.category === cat);
        if (games.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
              {CATEGORY_LABELS[cat]}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {games.map((g) => (
                <Link
                  key={g.key}
                  href={`/games/${g.key}`}
                  className="group relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/50"
                >
                  {partnerInGame === g.key && (
                    <span className="absolute right-2 top-2 rounded-full bg-success px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-text-on-primary">
                      Here
                    </span>
                  )}
                  <Emoji emoji={g.emoji} size={34} />
                  <span className="text-sm font-semibold text-text">{g.name}</span>
                  <span className="text-xs text-text-muted">{g.tagline}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
