'use client';

// Circles › Following — circles THIS circle (the [id] in the route) follows, not
// the viewer's own (§1.6). Reached by tapping the "following" stat on the profile
// header. Uses the shared ConnectionsList scoped to the circle via the public
// GET /circles/:id/following (visibility enforced server-side).

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ConnectionsList } from '@/components/circles';

export default function CircleFollowingPage() {
  const params = useParams<{ id: string }>();
  const idOrHandle = params?.id;

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

      <ConnectionsList kind="following" circleIdOrHandle={idOrHandle} />
    </div>
  );
}
