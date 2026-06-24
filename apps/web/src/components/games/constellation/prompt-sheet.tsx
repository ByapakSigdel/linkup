'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { useConstellationStore } from '@/stores/constellation-store';
import { useToastStore } from '@/stores/toast-store';
import { CONSTELLATIONS, promptsFor } from './deck';
import type { Prompt } from './types';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type GuessRole = 'subject' | 'guesser';

/** What the user is currently doing inside the sheet. */
type Step =
  | { kind: 'list' }
  | { kind: 'role-pick'; prompt: Prompt }
  | { kind: 'answer'; prompt: Prompt; role?: GuessRole }
  | { kind: 'custom' };

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function usePartnerName(): string {
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  if (!couple || !user) return 'your partner';
  const partnerId =
    couple.partner1Id === user.id ? couple.partner2Id : couple.partner1Id;
  // We only have the partner's id here; the display name isn't in the couple
  // object, so fall back gracefully.
  void partnerId;
  return 'your partner';
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

/** The back-button row inside the sheet. */
function BackRow({ onBack, label = 'Back' }: { onBack: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="self-start pb-1 text-sm text-primary transition-colors hover:underline"
    >
      ‹ {label}
    </button>
  );
}

/** Answer step — collects text then calls store.answer. */
function AnswerStep({
  prompt,
  role,
  onClose,
  onBack,
}: {
  prompt: Prompt;
  role?: GuessRole;
  onClose: () => void;
  onBack: () => void;
}) {
  const answer = useConstellationStore((s) => s.answer);
  const toast = useToastStore.getState();
  const partnerName = usePartnerName();

  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const placeholder =
    prompt.kind === 'guess'
      ? role === 'subject'
        ? 'Write your answer…'
        : `Guess ${partnerName}'s answer…`
      : 'Write your answer…';

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      let contribution: unknown;
      if (prompt.kind === 'guess') {
        contribution = { role: role ?? 'subject', text: text.trim() };
      } else {
        contribution = { text: text.trim() };
      }
      await answer({
        constellationKey: prompt.constellationKey,
        promptKey: prompt.key,
        kind: prompt.kind === 'guess' ? 'guess' : 'shared',
        title: prompt.title,
        contribution,
      });
      onClose();
    } catch {
      toast.push({ title: 'Could not save', body: 'Please try again.', variant: 'info' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <BackRow onBack={onBack} />
      <p className="text-base font-semibold text-text">{prompt.title}</p>
      {prompt.kind === 'guess' && role === 'guesser' && (
        <p className="text-xs text-text-muted">Guessing {partnerName}&apos;s answer</p>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={4}
        autoFocus
        className="min-h-24 w-full resize-none rounded-[var(--lk-input-radius)] border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
      />
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          loading={saving}
          disabled={!text.trim()}
        >
          Save
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Role-picker step for guess prompts. */
function RolePickStep({
  prompt,
  onPick,
  onBack,
}: {
  prompt: Prompt;
  onPick: (role: GuessRole) => void;
  onBack: () => void;
}) {
  const partnerName = usePartnerName();
  return (
    <div className="flex flex-col gap-3">
      <BackRow onBack={onBack} />
      <p className="text-base font-semibold text-text">{prompt.title}</p>
      <p className="text-sm text-text-muted">Who are you answering for?</p>
      <Button variant="primary" onClick={() => onPick('subject')}>
        Answer about myself
      </Button>
      <Button variant="secondary" onClick={() => onPick('guesser')}>
        Guess {partnerName}&apos;s answer
      </Button>
    </div>
  );
}

/** Write-your-own step. */
function CustomStep({
  onClose,
  onBack,
}: {
  onClose: () => void;
  onBack: () => void;
}) {
  const answer = useConstellationStore((s) => s.answer);
  const toast = useToastStore.getState();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || !text.trim()) return;
    setSaving(true);
    try {
      await answer({
        constellationKey: 'custom',
        kind: 'custom',
        title: title.trim(),
        contribution: { text: text.trim() },
      });
      onClose();
    } catch {
      toast.push({ title: 'Could not save', body: 'Please try again.', variant: 'info' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <BackRow onBack={onBack} />
      <p className="text-base font-semibold text-text">Write your own star ✍️</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="A short title…"
        autoFocus
        className="h-10 w-full rounded-[var(--lk-input-radius)] border border-border bg-surface px-3.5 text-sm text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your memory or moment…"
        rows={4}
        className="min-h-24 w-full resize-none rounded-[var(--lk-input-radius)] border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
      />
      <div className="flex gap-2">
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          loading={saving}
          disabled={!title.trim() || !text.trim()}
        >
          Save
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ─── Deck browser (list step) ────────────────────────────────────────────── */

function DeckList({
  dailyPrompt,
  onSelectPrompt,
  onCustom,
}: {
  dailyPrompt: Prompt | null;
  onSelectPrompt: (p: Prompt) => void;
  onCustom: () => void;
}) {
  // Per-constellation spicy-reveal toggle.
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      {/* Daily highlight */}
      {dailyPrompt && (
        <Card cardStyle="elevated" className="border-2 border-primary">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-primary">★</span>
              <span className="text-xs font-bold text-primary">Today&apos;s star</span>
            </div>
            <p className="text-base font-semibold text-text">{dailyPrompt.title}</p>
            <div>
              <Button variant="primary" size="sm" onClick={() => onSelectPrompt(dailyPrompt)}>
                Light this star
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Constellation groups */}
      {CONSTELLATIONS.map((constellation) => {
        const prompts = promptsFor(constellation.key);
        const warmDeep = prompts.filter((p) => p.tier !== 'spicy');
        const spicy = prompts.filter((p) => p.tier === 'spicy');
        const isRevealed = !!revealed[constellation.key];

        return (
          <div key={constellation.key} className="flex flex-col gap-2">
            {/* Constellation header */}
            <div>
              <p className="text-sm font-bold text-text">{constellation.name}</p>
              <p className="text-xs text-text-muted">{constellation.blurb}</p>
            </div>

            {/* Warm + deep prompts */}
            {warmDeep.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelectPrompt(p)}
                className="rounded-[var(--lk-card-radius)] border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <p className="text-sm text-text">{p.title}</p>
                {p.tier === 'deep' && (
                  <p className="mt-0.5 text-xs text-secondary">Deep</p>
                )}
              </button>
            ))}

            {/* Spicy gate */}
            {spicy.length > 0 &&
              (!isRevealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed((r) => ({ ...r, [constellation.key]: true }))}
                  className="rounded-[var(--lk-card-radius)] border border-border bg-surface-hover px-3 py-2.5 text-center transition-colors hover:bg-surface-active"
                >
                  <span className="text-xs text-text-muted">Just Us 🔒 — tap to reveal</span>
                </button>
              ) : (
                spicy.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => onSelectPrompt(p)}
                    className="rounded-[var(--lk-card-radius)] border border-accent bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <p className="text-sm text-text">{p.title}</p>
                    <p className="mt-0.5 text-xs text-accent">🔥 Spicy</p>
                  </button>
                ))
              ))}
          </div>
        );
      })}

      {/* Write your own */}
      <button
        type="button"
        onClick={onCustom}
        className="rounded-[var(--lk-card-radius)] border border-border bg-surface-hover px-4 py-3 text-center transition-colors hover:bg-surface-active"
      >
        <p className="text-sm font-medium text-text">Write your own ✍️</p>
        <p className="text-xs text-text-muted">Add a memory or moment of your own</p>
      </button>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function PromptSheet({
  visible,
  onClose,
  dailyPrompt,
}: {
  visible: boolean;
  onClose: () => void;
  dailyPrompt: Prompt | null;
}) {
  const [step, setStep] = useState<Step>({ kind: 'list' });

  // Reset to the list whenever the sheet opens.
  useEffect(() => {
    if (visible) setStep({ kind: 'list' });
  }, [visible]);

  function handleSelectPrompt(p: Prompt) {
    if (p.kind === 'guess') {
      setStep({ kind: 'role-pick', prompt: p });
    } else {
      setStep({ kind: 'answer', prompt: p });
    }
  }

  function handleRolePick(role: GuessRole) {
    if (step.kind === 'role-pick') {
      setStep({ kind: 'answer', prompt: step.prompt, role });
    }
  }

  function handleBack() {
    if (step.kind === 'answer' && step.role !== undefined) {
      // Came from role-pick — go back there.
      setStep({ kind: 'role-pick', prompt: step.prompt });
    } else {
      setStep({ kind: 'list' });
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div
        className={cn(
          'relative flex max-h-[88vh] w-full max-w-2xl flex-col',
          'rounded-t-2xl border border-b-0 border-border bg-surface shadow-xl',
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-1">
          <p className="text-base font-semibold text-text">
            {step.kind === 'list' ? 'Light a Star' : ''}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-7 text-text-muted transition-colors hover:text-text"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-4 pb-10 pt-2">
          {step.kind === 'list' && (
            <DeckList
              dailyPrompt={dailyPrompt}
              onSelectPrompt={handleSelectPrompt}
              onCustom={() => setStep({ kind: 'custom' })}
            />
          )}

          {step.kind === 'role-pick' && (
            <RolePickStep
              prompt={step.prompt}
              onPick={handleRolePick}
              onBack={() => setStep({ kind: 'list' })}
            />
          )}

          {step.kind === 'answer' && (
            <AnswerStep
              prompt={step.prompt}
              role={step.role}
              onClose={onClose}
              onBack={handleBack}
            />
          )}

          {step.kind === 'custom' && (
            <CustomStep onClose={onClose} onBack={() => setStep({ kind: 'list' })} />
          )}
        </div>
      </div>
    </div>
  );
}
