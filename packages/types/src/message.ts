// ============================================
// Message Types
// ============================================

export type MessageType =
  | 'text'
  | 'photo'
  | 'video'
  | 'voice'
  | 'file'
  | 'location'
  | 'scribble'
  | 'poll'
  | 'system';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  coupleId: string;
  senderId: string;
  receiverId: string;

  // Content
  content: string;
  messageType: MessageType;

  // Rich content
  mediaUrls?: string[];
  fileMetadata?: FileMetadata;
  linkPreview?: LinkPreview;

  // Formatting
  formatting?: MessageFormatting;

  // Threading
  threadId?: string;
  isThreadStarter?: boolean;
  threadReplyCount?: number;
  threadLastReplyAt?: string;

  // Highlighting
  isHighlighted?: boolean;
  highlightColor?: string;
  highlightNote?: string;
  highlightCategory?: HighlightCategory;

  // Reactions
  reactions?: Record<string, MessageReaction[]>;

  // Status
  status: MessageStatus;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;

  // Edit/Delete
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  thumbnailUrl?: string;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export interface MessageFormatting {
  bold?: [number, number][];
  italic?: [number, number][];
  strikethrough?: [number, number][];
  code?: [number, number][];
  mentions?: string[];
}

export interface MessageReaction {
  userId: string;
  emoji: string;
  timestamp: string;
}

export type HighlightCategory =
  | 'love'
  | 'funny'
  | 'important'
  | 'celebration'
  | 'milestone'
  | 'custom';

export interface Thread {
  id: string;
  coupleId: string;
  starterMessageId: string;
  title?: string;
  status: 'active' | 'resolved' | 'archived';
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  resolvedAt?: string;
  resolvedBy?: string;
  isBookmarked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HighlightedMessage {
  id: string;
  messageId: string;
  coupleId: string;
  highlightedBy: string;
  category: HighlightCategory;
  color: string;
  note?: string;
  emoji?: string;
  isSharedWithPartner: boolean;
  highlightedAt: string;
  createdAt: string;
}

// WebSocket event types
export interface TypingIndicator {
  coupleId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceUpdate {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
}
