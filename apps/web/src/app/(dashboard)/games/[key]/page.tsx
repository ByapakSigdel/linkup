'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getGame } from '@/components/games/registry';
import { Emoji } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

export default function GameRoute() {
  const params = useParams<{ key: string }>();
  const couple = useAuthStore((s) => s.couple);
  const game = getGame(String(params?.key));

  if (!game) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-text-muted">That game doesn&apos;t exist.</p>
        <Link href="/games" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to games
        </Link>
      </div>
    );
  }

  if (!couple?.isPaired) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-text-muted">
        Link up with your partner to play together.
      </div>
    );
  }

  const Game = game.Component;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" /> All games
        </Link>
        <span className="flex items-center gap-2 text-sm font-semibold text-text">
          <Emoji emoji={game.emoji} size={20} />
          {game.name}
        </span>
      </div>

      <Game />
    </div>
  );
}
