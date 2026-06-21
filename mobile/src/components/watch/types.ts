export interface WatchParty {
  id: string;
  source: 'youtube' | 'url';
  /** YouTube video id (when source === 'youtube'). */
  videoId?: string | null;
  /** Direct media URL (when source === 'url'). */
  videoUrl?: string | null;
  title?: string | null;
  status?: 'active' | 'ended' | string;
  createdAt?: string;
  endedAt?: string | null;
}

export interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
  mine: boolean;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
}

/** Payloads over the watch:* socket events. */
export interface WatchLoadPayload {
  source?: 'youtube' | 'url';
  videoId?: string;
  videoUrl?: string;
  title?: string;
}

export interface WatchStatePayload {
  action: 'play' | 'pause' | 'seek';
  time: number;
}

export interface WatchChatPayload {
  text: string;
  userId?: string;
  timestamp?: number;
}

export interface WatchReactionPayload {
  emoji: string;
  userId?: string;
}
