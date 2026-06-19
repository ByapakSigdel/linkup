export type TrackSource = 'youtube' | 'spotify' | 'url';

export interface Track {
  id: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  coverUrl?: string | null;
  source: TrackSource;
  sourceId?: string | null;
  url?: string | null;
  duration?: number | null;
  position?: number;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  trackCount: number;
}

export interface PlaylistDetail {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
}

/** Payload relayed over the `music:state` socket event. */
export interface MusicState {
  trackId?: string;
  isPlaying: boolean;
  positionSec: number;
  track?: Track | null;
}
