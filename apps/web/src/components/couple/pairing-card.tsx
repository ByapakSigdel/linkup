'use client';

import { useState } from 'react';
import { Heart, Copy, Check, Link2 } from 'lucide-react';
import { Button, Input, Card } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';

/**
 * Lets a solo user create a couple space (and share the pairing code) or join
 * an existing one with a partner's code. Shown anywhere the user isn't paired.
 */
export function PairingCard() {
  const couple = useAuthStore((s) => s.couple);
  const hydrate = useAuthStore((s) => s.hydrate);

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [pairingCode, setPairingCode] = useState<string | null>(
    couple && !couple.isPaired ? couple.pairingCode ?? null : null,
  );
  const [joinCode, setJoinCode] = useState('');
  const [coupleName, setCoupleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/couples', {
        coupleName: coupleName || undefined,
      });
      setPairingCode(data.data.couple.pairingCode);
      await hydrate();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Could not create couple space');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    setLoading(true);
    setError('');
    try {
      await api.post('/couples/join', { pairingCode: joinCode.trim().toUpperCase() });
      await hydrate();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (!pairingCode) return;
    navigator.clipboard?.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // A code exists (created, waiting for partner)
  if (pairingCode) {
    return (
      <Card cardStyle="bordered" padding="lg" className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <Heart className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-text">Share your code</h2>
        <p className="mt-1 text-sm text-text-muted">
          Send this code to your partner. Once they enter it, you&apos;ll be linked.
        </p>
        <button
          onClick={copyCode}
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary-light py-5 text-center transition-colors hover:bg-primary/10"
        >
          <span className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">
            {pairingCode}
          </span>
          {copied ? (
            <Check className="h-5 w-5 text-success" />
          ) : (
            <Copy className="h-5 w-5 text-primary" />
          )}
        </button>
        <p className="mt-3 text-xs text-text-muted">
          {copied ? 'Copied to clipboard!' : 'Tap to copy'}
        </p>
        <Button
          variant="ghost"
          className="mt-4 w-full"
          onClick={() => hydrate()}
        >
          I&apos;ve shared it — refresh status
        </Button>
      </Card>
    );
  }

  return (
    <Card cardStyle="bordered" padding="lg" className="mx-auto max-w-md">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
        <Heart className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-center text-xl font-semibold text-text">
        Link up with your partner
      </h2>
      <p className="mt-1 text-center text-sm text-text-muted">
        Create your private couple space or join with your partner&apos;s code.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error">
          {error}
        </div>
      )}

      {mode === 'choose' && (
        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" onClick={() => setMode('create')}>
            <Heart className="h-4 w-4" /> Create a couple space
          </Button>
          <Button size="lg" variant="outline" onClick={() => setMode('join')}>
            <Link2 className="h-4 w-4" /> I have a code
          </Button>
        </div>
      )}

      {mode === 'create' && (
        <div className="mt-6 flex flex-col gap-3">
          <Input
            label="Couple name (optional)"
            placeholder="e.g. Alex & Sam"
            value={coupleName}
            onChange={(e) => setCoupleName(e.target.value)}
          />
          <Button size="lg" loading={loading} onClick={handleCreate}>
            Generate pairing code
          </Button>
          <Button variant="ghost" onClick={() => setMode('choose')}>
            Back
          </Button>
        </div>
      )}

      {mode === 'join' && (
        <div className="mt-6 flex flex-col gap-3">
          <Input
            label="Pairing code"
            placeholder="ABCD1234"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="font-mono tracking-widest uppercase"
          />
          <Button size="lg" loading={loading} onClick={handleJoin}>
            Link up
          </Button>
          <Button variant="ghost" onClick={() => setMode('choose')}>
            Back
          </Button>
        </div>
      )}
    </Card>
  );
}
