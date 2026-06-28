'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  Image as ImageIcon,
  Calendar,
  Sparkles,
  ChevronLeft,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useAuthStore, hasArchive } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { useMediaStore } from '@/stores/media-store';
import { MessageList } from '@/components/chat/message-list';
import { MediaGrid, MediaLightbox } from '@/components/media';
import { ConstellationOfUs } from '@/components/games/constellation';
import { Button, Card, Input, Spinner } from '@/components/ui';
import { GoogleReauthButton } from '@/components/auth/google-reauth-button';
import { cn } from '@/lib/cn';
import api from '@/lib/api';

type Tab = 'chat' | 'photos' | 'dates' | 'stars';

const TABS: { key: Tab; label: string; Icon: typeof MessageCircle }[] = [
  { key: 'chat', label: 'Messages', Icon: MessageCircle },
  { key: 'photos', label: 'Photos', Icon: ImageIcon },
  { key: 'dates', label: 'Dates', Icon: Calendar },
  { key: 'stars', label: 'Your sky', Icon: Sparkles },
];

/** Local error-message extractor — matches the web watch/music page pattern. */
function errMsg(e: unknown, fallback: string): string {
  return (
    (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message || fallback
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * The Memorial: a compassionate read-only space for a relationship that has come
 * to rest. Opened either as a takeover (survivor of a freshly-ended couple who
 * hasn't yet chosen) or revisited later from "Memories" once she has gone solo
 * (in which case the archived couple is already loaded via archivedCoupleId in
 * the auth hydrate). Mirrors mobile/src/app/memorial.tsx.
 *
 * The takeover offers two doors: look back on the shared memories (read-only),
 * and a gentle, de-emphasized fork — keep going solo, or wind down and leave.
 */
export default function MemorialPage() {
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();

  const archived = useAuthStore((s) => hasArchive({ user: s.user, couple: s.couple }));
  const couple = useAuthStore((s) => s.couple);
  const archiveAndGoSolo = useAuthStore((s) => s.archiveAndGoSolo);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  // 'intro' = the calm takeover; 'memorial' = the read-only tabbed archive. When
  // revisiting from Memories there's no decision to make, so jump straight in.
  const [view, setView] = useState<'intro' | 'memorial'>(archived ? 'memorial' : 'intro');
  const [tab, setTab] = useState<Tab>('chat');

  // If `archived` flips true after mount (e.g. Zustand persisted state hydrates
  // asynchronously, or archiveAndGoSolo completes), make sure a returning solo
  // survivor lands straight in the read-only archive rather than the takeover.
  useEffect(() => {
    if (archived && view === 'intro') setView('memorial');
  }, [archived, view]);

  // Fork state.
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [showLeave, setShowLeave] = useState(false);

  const anim = (delay: string) =>
    reduceMotion ? undefined : ({ animation: `lk-rise 700ms ease-out ${delay} both` } as const);

  const handleGoSolo = useCallback(async () => {
    setArchiving(true);
    setArchiveError('');
    try {
      await archiveAndGoSolo();
      router.replace('/dashboard');
    } catch (e) {
      setArchiving(false);
      setArchiveError(errMsg(e, 'Please try again in a moment.'));
    }
  }, [archiveAndGoSolo, router]);

  // ── Read-only memorial archive ──────────────────────────────────────────────
  if (view === 'memorial') {
    return (
      <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col lg:-m-6">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button
            type="button"
            onClick={() => (archived ? router.replace('/dashboard') : setView('intro'))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-text">Your memories</p>
            <p className="truncate text-xs text-text-muted">
              Read-only — kept just as they were
            </p>
          </div>
          <div className="h-9 w-9 shrink-0" />
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-xs font-semibold transition-colors -mb-px',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab body — reuse the existing views in read-only mode. */}
        <div className="min-h-0 flex-1">
          {tab === 'chat' ? <MemorialChat coupleId={couple?.id} /> : null}
          {tab === 'photos' ? <MemorialPhotos coupleId={couple?.id} /> : null}
          {tab === 'dates' ? <MemorialDates coupleId={couple?.id} /> : null}
          {tab === 'stars' ? (
            <div className="h-full overflow-y-auto">
              <ConstellationOfUs readOnly />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── The calm takeover ───────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <style>{`
        @keyframes lk-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes lk-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={reduceMotion ? undefined : { animation: 'lk-fade 1100ms ease-out both' }}>
        <Sparkles className="h-8 w-8 text-primary" />
      </div>

      <h1 className="mt-6 font-display text-3xl leading-snug text-text" style={anim('150ms')}>
        Your shared space with your partner has come to rest.
      </h1>

      <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-text-muted" style={anim('320ms')}>
        Everything you made together is still here, just as it was. Take all the
        time you need — there&apos;s nothing you have to decide right now.
      </p>

      {/* Primary affordance */}
      <div className="mt-9 w-full" style={anim('520ms')}>
        <Button
          variant="primary"
          size="lg"
          shape="pill"
          className="w-full"
          onClick={() => setView('memorial')}
        >
          Look back on your memories
        </Button>
      </div>

      {/* The gentle, de-emphasized fork — never forced. */}
      <div className="mt-9 w-full" style={anim('700ms')}>
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
          When you&apos;re ready
        </p>

        <button
          type="button"
          onClick={handleGoSolo}
          disabled={archiving}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">Keep going on your own</p>
            <p className="text-xs text-text-muted">
              Continue solo. These memories stay, read-only, under Memories.
            </p>
          </div>
          {archiving ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-muted" />
          ) : (
            <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowLeave(true)}
          className="mt-2.5 flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-hover"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-muted">Wind down &amp; leave</p>
            <p className="text-xs text-text-muted">
              Close your account too. This can&apos;t be undone.
            </p>
          </div>
        </button>

        {archiveError && (
          <p className="mt-3 text-xs text-error" role="alert">
            {archiveError}
          </p>
        )}
      </div>

      <LeaveDialog
        open={showLeave}
        onClose={() => setShowLeave(false)}
        deleteAccount={deleteAccount}
      />
    </div>
  );
}

/* ─── Wind-down confirm dialog (password) ──────────────────────────────────── */
function LeaveDialog({
  open,
  onClose,
  deleteAccount,
}: {
  open: boolean;
  onClose: () => void;
  deleteAccount: (password: string, googleIdToken?: string) => Promise<void>;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Always reset local state on dismissal (backdrop, Cancel, Escape) so a
  // re-opened dialog never shows a stale typed password or error.
  const close = useCallback(() => {
    if (busy) return;
    setPassword('');
    setError('');
    onClose();
  }, [busy, onClose]);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  // Shared finalizer for both re-auth paths (password + Google).
  const finalize = useCallback(
    async (run: () => Promise<void>) => {
      setBusy(true);
      setError('');
      try {
        await run();
        router.replace('/goodbye');
      } catch (e) {
        setBusy(false);
        setError(errMsg(e, 'We could not verify that. Please try again.'));
      }
    },
    [router],
  );

  const handleConfirm = useCallback(() => {
    if (!password) {
      setError('Enter your password, or confirm with Google below.');
      return;
    }
    void finalize(() => deleteAccount(password));
  }, [password, deleteAccount, finalize]);

  // OAuth-only survivors confirm leaving with a fresh Google ID token instead of
  // a password (their stored hash is a random value they can never reproduce).
  const handleGoogleConfirm = useCallback(
    (credential: string) => {
      if (busy) return;
      void finalize(() => deleteAccount('', credential));
    },
    [busy, finalize, deleteAccount],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />
      <Card cardStyle="elevated" padding="md" className="relative w-full max-w-md">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-text">Wind down &amp; leave</h2>
          <p className="text-sm text-text-muted">
            This closes your account for good. Once you&apos;re both gone, the
            memories you shared are gently cleared away. Enter your password to
            confirm.
          </p>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            disabled={busy}
            error={error || undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
          />
          {/* Google sign-in path — the only way an OAuth-only account (no usable
              password) can re-authenticate. Renders nothing if Google isn't set. */}
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="h-px flex-1 bg-border" />
            or confirm with Google
            <span className="h-px flex-1 bg-border" />
          </div>
          <GoogleReauthButton onCredential={handleGoogleConfirm} disabled={busy} />
          <div className="mt-1 flex gap-2">
            <Button variant="ghost" className="flex-1" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              loading={busy}
              onClick={handleConfirm}
            >
              Leave
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ─── Shared "can't reach these memories" state ────────────────────────────── */
// Shown when the archive fetch is rejected (e.g. a 403 because the API doesn't
// yet authorize a now-solo survivor's archived-couple membership) or otherwise
// fails. Distinct from the genuinely-empty states below so we never silently
// pretend an unreachable archive is empty. Backend follow-up tracked in the
// StructuredOutput concerns: /messages, /media, /dates, and /constellation
// should authorize reads by `user.archivedCoupleId === coupleId`.
function MemorialUnavailable({ Icon }: { Icon: typeof MessageCircle }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <Icon className="h-10 w-10 text-text-muted" />
      <p className="mt-2 text-base font-semibold text-text">
        These memories aren&apos;t loading
      </p>
      <p className="mt-1 max-w-xs text-sm text-text-muted">
        We couldn&apos;t reach this part of your archive right now. Please try
        again in a little while.
      </p>
    </div>
  );
}

/* ─── Read-only chat ───────────────────────────────────────────────────────── */
function MemorialChat({ coupleId }: { coupleId?: string }) {
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const reset = useChatStore((s) => s.reset);
  // Surface a fetch failure (e.g. a 403 on the archived couple) explicitly
  // rather than letting the silently-swallowed error read as an empty thread.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!coupleId) return;
    let mounted = true;
    setFailed(false);
    fetchMessages(coupleId).then((status) => {
      if (mounted && status !== 'ok') setFailed(true);
    });
    return () => {
      mounted = false;
      reset();
    };
  }, [coupleId, fetchMessages, reset]);

  if (failed) return <MemorialUnavailable Icon={MessageCircle} />;

  return (
    <div className="flex h-full flex-col">
      <MessageList readOnly />
    </div>
  );
}

/* ─── Read-only photos ─────────────────────────────────────────────────────── */
function MemorialPhotos({ coupleId }: { coupleId?: string }) {
  const items = useMediaStore((s) => s.items);
  const isLoading = useMediaStore((s) => s.isLoading);
  const fetchMedia = useMediaStore((s) => s.fetchMedia);
  const openLightbox = useMediaStore((s) => s.openLightbox);
  // Surface a fetch failure (e.g. a 403 on the archived couple) explicitly
  // rather than letting the silently-swallowed error read as an empty gallery.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!coupleId) return;
    let mounted = true;
    setFailed(false);
    fetchMedia(coupleId).then((status) => {
      if (mounted && status !== 'ok') setFailed(true);
    });
    return () => {
      mounted = false;
    };
  }, [coupleId, fetchMedia]);

  if (failed) return <MemorialUnavailable Icon={ImageIcon} />;

  return (
    <div className="h-full overflow-y-auto p-4">
      {isLoading && items.length === 0 ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <MediaGrid items={items} readOnly onItemClick={(_, index) => openLightbox(index)} />
      )}
      <MediaLightbox readOnly />
    </div>
  );
}

/* ─── Read-only important dates ────────────────────────────────────────────── */
interface MemorialDate {
  id: string;
  title: string;
  date: string;
}

function MemorialDates({ coupleId }: { coupleId?: string }) {
  const [dates, setDates] = useState<MemorialDate[] | null>(null);
  // Distinguish a genuine "no dates" from a fetch failure (e.g. a 403 because
  // the API doesn't yet authorize the now-solo survivor's archived couple) so we
  // don't render an empty state over an unreachable archive.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setFailed(false);
    // Forward the couple id explicitly: an already-solo survivor revisiting
    // Memories has a null live coupleId on the server, so without this the
    // archived couple's dates resolve to a 404 and the empty state hides them.
    api
      .get('/dates', coupleId ? { params: { coupleId } } : undefined)
      .then(({ data }) => {
        if (mounted) setDates(data.data?.dates ?? []);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [coupleId]);

  if (failed) return <MemorialUnavailable Icon={Calendar} />;

  if (dates === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <Calendar className="h-10 w-10 text-text-muted" />
        <p className="mt-2 text-base font-semibold text-text">No marked dates</p>
        <p className="mt-1 max-w-xs text-sm text-text-muted">
          There are no important dates saved between you.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        {dates.map((d) => (
          <Card key={d.id} cardStyle="bordered" padding="md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{d.title}</p>
                <p className="text-xs text-text-muted">
                  {new Date(d.date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
