'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Music, Headphones, Radio } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import { PlaylistList } from '@/components/music/playlist-list';
import { TrackPanel, type NewTrackInput } from '@/components/music/track-panel';
import { PlayerBar } from '@/components/music/player-bar';
import type {
  PlaylistSummary,
  PlaylistDetail,
  Track,
  MusicState,
} from '@/components/music/types';

function errMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message || fallback;
}

export default function MusicPage() {
  const couple = useAuthStore((s) => s.couple);
  const pushToast = useToastStore((s) => s.push);

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [creating, setCreating] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playlistDetail, setPlaylistDetail] = useState<PlaylistDetail | null>(
    null,
  );
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [adding, setAdding] = useState(false);

  // Player state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Listen-together
  const [listenTogether, setListenTogether] = useState(false);
  const [partnerActive, setPartnerActive] = useState(false);
  const listenTogetherRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const partnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listenTogetherRef.current = listenTogether;
  }, [listenTogether]);

  // ---- Data loading ------------------------------------------------------

  const fetchPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const { data } = await api.get('/music/playlists');
      const list: PlaylistSummary[] = data.data.playlists ?? [];
      setPlaylists(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch (err) {
      pushToast({
        title: 'Could not load playlists',
        body: errMessage(err, 'Please try again.'),
        variant: 'info',
      });
    } finally {
      setLoadingPlaylists(false);
    }
  }, [pushToast]);

  const fetchPlaylistDetail = useCallback(async (id: string) => {
    setLoadingTracks(true);
    try {
      const { data } = await api.get(`/music/playlists/${id}`);
      setPlaylistDetail(data.data.playlist ?? null);
      setTracks(data.data.tracks ?? []);
    } catch {
      setPlaylistDetail(null);
      setTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  }, []);

  useEffect(() => {
    if (couple?.isPaired) fetchPlaylists();
  }, [couple?.isPaired, fetchPlaylists]);

  useEffect(() => {
    if (selectedId) fetchPlaylistDetail(selectedId);
    else {
      setPlaylistDetail(null);
      setTracks([]);
    }
  }, [selectedId, fetchPlaylistDetail]);

  // ---- Listen-together: relay + receive ---------------------------------

  const broadcastState = useCallback(
    (track: Track | null, playing: boolean, positionSec = 0) => {
      if (!listenTogetherRef.current) return;
      const payload: MusicState = {
        trackId: track?.id,
        isPlaying: playing,
        positionSec,
        track,
      };
      // Persist + relay via REST, and also emit directly for low latency.
      api.post('/music/listen/state', payload).catch(() => {});
      getSocket()?.emit('music:state', payload);
    },
    [],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onState = (state: MusicState) => {
      if (!listenTogetherRef.current) return;

      // Flag a partner as actively listening for ~30s.
      setPartnerActive(true);
      if (partnerTimerRef.current) clearTimeout(partnerTimerRef.current);
      partnerTimerRef.current = setTimeout(
        () => setPartnerActive(false),
        30000,
      );

      if (state.track) {
        applyingRemoteRef.current = true;
        setCurrentTrack(state.track);
        setIsPlaying(state.isPlaying);
        // Release the guard after React has applied the remote-driven update.
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      } else {
        setIsPlaying(state.isPlaying);
      }
    };

    socket.on('music:state', onState);
    return () => {
      socket.off('music:state', onState);
      if (partnerTimerRef.current) clearTimeout(partnerTimerRef.current);
    };
  }, []);

  // ---- Actions -----------------------------------------------------------

  const handleCreatePlaylist = useCallback(
    async (name: string, description: string) => {
      setCreating(true);
      try {
        const { data } = await api.post('/music/playlists', {
          name,
          description: description || undefined,
        });
        const created = data.data.playlist;
        await fetchPlaylists();
        if (created?.id) setSelectedId(created.id);
        pushToast({ title: 'Playlist created', variant: 'success' });
      } catch (err) {
        pushToast({
          title: 'Could not create playlist',
          body: errMessage(err, 'Please try again.'),
          variant: 'info',
        });
      } finally {
        setCreating(false);
      }
    },
    [fetchPlaylists, pushToast],
  );

  const handleDeletePlaylist = useCallback(async () => {
    if (!selectedId) return;
    if (!window.confirm('Delete this playlist? This cannot be undone.')) return;
    try {
      await api.delete(`/music/playlists/${selectedId}`);
      setSelectedId(null);
      await fetchPlaylists();
      pushToast({ title: 'Playlist deleted', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Could not delete playlist',
        body: errMessage(err, 'Please try again.'),
        variant: 'info',
      });
    }
  }, [selectedId, fetchPlaylists, pushToast]);

  const handleAddTrack = useCallback(
    async (input: NewTrackInput) => {
      if (!selectedId) return;
      setAdding(true);
      try {
        await api.post(`/music/playlists/${selectedId}/tracks`, input);
        await fetchPlaylistDetail(selectedId);
        fetchPlaylists(); // refresh track counts
      } catch (err) {
        pushToast({
          title: 'Could not add track',
          body: errMessage(err, 'Please try again.'),
          variant: 'info',
        });
      } finally {
        setAdding(false);
      }
    },
    [selectedId, fetchPlaylistDetail, fetchPlaylists, pushToast],
  );

  const handleDeleteTrack = useCallback(
    async (trackId: string) => {
      if (!selectedId) return;
      try {
        await api.delete(`/music/playlists/${selectedId}/tracks/${trackId}`);
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
        if (currentTrack?.id === trackId) {
          setCurrentTrack(null);
          setIsPlaying(false);
        }
        fetchPlaylists();
      } catch (err) {
        pushToast({
          title: 'Could not remove track',
          body: errMessage(err, 'Please try again.'),
          variant: 'info',
        });
      }
    },
    [selectedId, currentTrack?.id, fetchPlaylists, pushToast],
  );

  const playTrack = useCallback(
    (track: Track) => {
      setCurrentTrack(track);
      setIsPlaying(true);
      if (!applyingRemoteRef.current) broadcastState(track, true, 0);
    },
    [broadcastState],
  );

  const currentIndex = currentTrack
    ? tracks.findIndex((t) => t.id === currentTrack.id)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < tracks.length - 1;

  const playPrev = useCallback(() => {
    const prev = tracks[currentIndex - 1];
    if (hasPrev && prev) playTrack(prev);
  }, [hasPrev, currentIndex, tracks, playTrack]);

  const playNext = useCallback(() => {
    const next = tracks[currentIndex + 1];
    if (hasNext && next) playTrack(next);
  }, [hasNext, currentIndex, tracks, playTrack]);

  // ---- Empty state (not paired) -----------------------------------------

  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LinkupMark size={56} className="mb-4" />
        <h2 className="text-lg font-semibold text-text">Music together</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Link up with your partner to build shared playlists and listen along
          in real time.
        </p>
      </div>
    );
  }

  // ---- Page --------------------------------------------------------------

  return (
    <div className="mx-auto flex max-w-6xl flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Music className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-text">Music</h1>
            <p className="text-sm text-text-muted">
              Shared playlists and listening together
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {listenTogether && partnerActive && (
            <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              Listening together
            </span>
          )}
          <Button
            variant={listenTogether ? 'secondary' : 'outline'}
            size="sm"
            shape="pill"
            onClick={() => {
              const next = !listenTogether;
              setListenTogether(next);
              if (next && currentTrack) {
                // Sync our current track to partner on enable.
                listenTogetherRef.current = true;
                broadcastState(currentTrack, isPlaying, 0);
              }
              if (!next) setPartnerActive(false);
            }}
            aria-pressed={listenTogether}
          >
            <Headphones className="h-4 w-4" />
            {listenTogether ? 'Listening together' : 'Listen together'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        <PlaylistList
          playlists={playlists}
          selectedId={selectedId}
          loading={loadingPlaylists}
          creating={creating}
          onSelect={setSelectedId}
          onCreate={handleCreatePlaylist}
        />
        <TrackPanel
          playlist={playlistDetail}
          tracks={tracks}
          loading={loadingTracks}
          adding={adding}
          currentTrackId={currentTrack?.id ?? null}
          isPlaying={isPlaying}
          onPlay={playTrack}
          onAddTrack={handleAddTrack}
          onDeleteTrack={handleDeleteTrack}
          onDeletePlaylist={handleDeletePlaylist}
        />
      </div>

      {currentTrack && (
        <PlayerBar
          track={currentTrack}
          isPlaying={isPlaying}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={playPrev}
          onNext={playNext}
          onClose={() => {
            setCurrentTrack(null);
            setIsPlaying(false);
            if (!applyingRemoteRef.current) broadcastState(null, false, 0);
          }}
          onAudioPlay={() => {
            setIsPlaying(true);
            if (!applyingRemoteRef.current)
              broadcastState(currentTrack, true, 0);
          }}
          onAudioPause={() => {
            setIsPlaying(false);
            if (!applyingRemoteRef.current)
              broadcastState(currentTrack, false, 0);
          }}
          onAudioEnded={playNext}
        />
      )}

      <p
        className={cn(
          'mt-3 text-center text-xs text-text-muted',
          !currentTrack && 'hidden',
        )}
      >
        Best-effort sync: track selection and play/pause are shared. Fine
        position scrubbing stays local.
      </p>
    </div>
  );
}
