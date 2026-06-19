'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Music } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { Spinner } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import {
  SoundPad,
  SoundCreator,
  type BoardSound,
  type NewSoundPayload,
} from '@/components/soundboard';

function errMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } }).response
      ?.data?.error?.message ?? fallback
  );
}

export default function SoundBoardPage() {
  const couple = useAuthStore((s) => s.couple);
  const [sounds, setSounds] = useState<BoardSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadSounds = useCallback(async () => {
    try {
      const { data } = await api.get('/creative/soundboard');
      setSounds(data.data.sounds ?? []);
    } catch (err: unknown) {
      useToastStore.getState().push({
        title: 'Something went wrong',
        body: errMessage(err, 'Could not load your soundboard.'),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (couple?.isPaired) {
      void loadSounds();
    } else {
      setLoading(false);
    }
  }, [couple?.isPaired, loadSounds]);

  // Stop any playing audio on unmount.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const handleCreate = useCallback(async (payload: NewSoundPayload) => {
    try {
      const { data } = await api.post('/creative/soundboard', payload);
      const created: BoardSound = data.data.sound;
      setSounds((prev) => [created, ...prev]);
      useToastStore.getState().push({
        title: 'Sound added',
        body: `${created.emoji ? created.emoji + ' ' : ''}${created.name} is on your board`,
        icon: '🎵',
      });
    } catch (err: unknown) {
      useToastStore.getState().push({
        title: 'Add failed',
        body: errMessage(err, 'Could not add that sound.'),
      });
      throw err;
    }
  }, []);

  const handlePlay = useCallback(async (sound: BoardSound) => {
    // Play locally.
    try {
      audioRef.current?.pause();
      const audio = new Audio(sound.audioUrl);
      audioRef.current = audio;
      setPlayingId(sound.id);
      audio.onended = () =>
        setPlayingId((cur) => (cur === sound.id ? null : cur));
      audio.onerror = () =>
        setPlayingId((cur) => (cur === sound.id ? null : cur));
      await audio.play();
    } catch {
      setPlayingId((cur) => (cur === sound.id ? null : cur));
    }

    // Optimistic use count bump.
    setSounds((prev) =>
      prev.map((s) =>
        s.id === sound.id ? { ...s, useCount: s.useCount + 1 } : s,
      ),
    );

    useToastStore.getState().push({
      title: `Played ${sound.name} for your partner`,
      icon: sound.emoji || '🔊',
    });

    // Relay to partner.
    try {
      await api.post(`/creative/soundboard/${sound.id}/play`);
    } catch {
      // Non-fatal: it already played locally.
    }
  }, []);

  const handleDelete = useCallback(async (sound: BoardSound) => {
    setDeletingId(sound.id);
    try {
      await api.delete(`/creative/soundboard/${sound.id}`);
      setSounds((prev) => prev.filter((s) => s.id !== sound.id));
      useToastStore.getState().push({
        title: 'Sound deleted',
        body: `${sound.name} was removed`,
      });
    } catch (err: unknown) {
      useToastStore.getState().push({
        title: 'Delete failed',
        body: errMessage(err, 'Could not delete that sound.'),
      });
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ---- Not paired ----
  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-active">
          <LinkupMark size={30} />
        </div>
        <h2 className="text-lg font-semibold text-text">SoundBoard</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Link up with your partner to build a shared soundboard — tap a pad and
          they hear it too.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">SoundBoard</h1>
        <p className="text-sm text-text-muted">
          Record or upload sounds, then tap a pad to play it on both your devices.
        </p>
      </div>

      <SoundCreator onCreate={handleCreate} />

      {/* Pads */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          Your pads
          {!loading && sounds.length > 0 && (
            <span className="ml-2 font-mono text-text-muted">({sounds.length})</span>
          )}
        </h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary" />
          </div>
        ) : sounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-active">
              <Music className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text">No sounds yet</p>
            <p className="mt-1 max-w-xs text-xs text-text-muted">
              Add your first sound above — record a quick clip or upload a file.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {sounds.map((sound) => (
              <SoundPad
                key={sound.id}
                sound={sound}
                onPlay={handlePlay}
                onDelete={handleDelete}
                playing={playingId === sound.id}
                deleting={deletingId === sound.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
