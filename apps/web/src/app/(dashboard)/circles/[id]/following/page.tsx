'use client';

// Circles › Following — owner-only list of couples this circle follows (§1.6).
// Reached by tapping the "following" stat on the profile header. Uses the shared
// ConnectionsList, which consumes GET /circles/me/following.

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';
import { Card } from '@/components/ui';
import { ConnectionsList } from '@/components/circles';
import { useAuthStore } from '@/stores/auth-store';

export default function CircleFollowingPage() {
  const params = useParams<{ id: string }>();
  const idOrHandle = params?.id;
  const couple = useAuthStore((s) => s.couple);

  if (!couple?.isPaired) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text">
              Link up with your partner first
            </h2>
            <p className="max-w-sm text-sm text-text-muted">
              Pair with your partner to manage who your circle follows.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <Link
        href={`/circles/${encodeURIComponent(idOrHandle ?? '')}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to profile
      </Link>

      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Couple Circles
        </p>
        <h1 className="font-display text-2xl font-bold text-text">Following</h1>
      </div>

      <ConnectionsList kind="following" />
    </div>
  );
}
