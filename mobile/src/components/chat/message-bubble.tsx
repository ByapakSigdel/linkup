import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Reply,
  Pencil,
  Trash2,
  Star,
  SmilePlus,
} from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import {
  useCustomEmojiStore,
  type CustomEmojiEntry,
} from '@/stores/custom-emoji-store';
import { resolveMediaUrl } from '@/lib/env';
import { ALL_REACTIONS } from './reaction-packs';
import { STICKER_REACTIONS, ReactionGlyph, Emoji, isSticker } from './stickers';
import { MediaMessage } from './media-message';
import type { Message, MessageStatus, HighlightCategory } from '@/types';

// ─── Custom-emoji shortcode rendering ──────────────────────────────────────────
function MessageText({
  content,
  byName,
  color,
}: {
  content: string;
  byName: Record<string, CustomEmojiEntry>;
  color: string;
}) {
  if (!content.includes(':')) {
    return <AppText variant="body" color={color}>{content}</AppText>;
  }
  const parts = content.split(/(:[a-zA-Z0-9_+-]+:)/g);

  // Discord/Slack-style "jumbo" emoji: if the whole message is just custom
  // emoji(s), render them large instead of tiny inline glyphs.
  const tokens = parts.filter((p) => p.trim().length > 0);
  const emojiTokens = tokens.filter((p) => {
    const m = /^:([a-zA-Z0-9_+-]+):$/.exec(p);
    return !!(m && byName[m[1]!]);
  });
  const emojiOnly = tokens.length > 0 && emojiTokens.length === tokens.length;

  if (emojiOnly) {
    const size = emojiTokens.length === 1 ? 64 : emojiTokens.length <= 3 ? 44 : 32;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {emojiTokens.map((part, i) => {
          const m = /^:([a-zA-Z0-9_+-]+):$/.exec(part)!;
          const uri = resolveMediaUrl(byName[m[1]!]!.imageUrl);
          return (
            <Image
              key={i}
              source={{ uri }}
              style={{ width: size, height: size }}
              contentFit="contain"
            />
          );
        })}
      </View>
    );
  }

  return (
    <AppText variant="body" color={color}>
      {parts.map((part, i) => {
        const match = /^:([a-zA-Z0-9_+-]+):$/.exec(part);
        const emoji = match ? byName[match[1]!] : undefined;
        if (emoji) {
          const uri = resolveMediaUrl(emoji.imageUrl);
          return (
            <Image
              key={i}
              source={{ uri }}
              style={styles.inlineEmoji}
              contentFit="contain"
            />
          );
        }
        return part;
      })}
    </AppText>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────
function StatusIcon({ status, color }: { status: MessageStatus; color: string }) {
  const { colors } = useTheme();
  switch (status) {
    case 'sending':
      return <Clock color={color} size={12} />;
    case 'sent':
      return <Check color={color} size={12} />;
    case 'delivered':
      return <CheckCheck color={color} size={12} />;
    case 'read':
      return <CheckCheck color={colors.info} size={12} />;
    case 'failed':
      return <AlertCircle color={colors.error} size={12} />;
    default:
      return null;
  }
}

// ─── Reactions display ────────────────────────────────────────────────────────
function ReactionsDisplay({
  reactions,
  align,
}: {
  reactions: Record<string, { userId: string; emoji: string; timestamp: string }[]>;
  align: 'flex-end' | 'flex-start';
}) {
  const { colors } = useTheme();
  const entries = Object.entries(reactions).filter(([, arr]) => arr.length > 0);
  if (entries.length === 0) return null;
  return (
    <View style={[styles.reactionsRow, { justifyContent: align }]}>
      {entries.map(([emoji, arr]) => (
        <Animated.View
          key={emoji}
          entering={FadeIn.duration(180)}
          style={[
            styles.reactionPill,
            {
              borderColor: colors.border,
              backgroundColor: isSticker(emoji) ? '#ffffffF2' : colors.surfaceHover,
            },
          ]}
        >
          <ReactionGlyph value={emoji} size={14} />
          {arr.length > 1 && (
            <AppText
              variant="caption"
              color={isSticker(emoji) ? '#17171c' : colors.textMuted}
              style={styles.reactionCount}
            >
              {arr.length}
            </AppText>
          )}
        </Animated.View>
      ))}
    </View>
  );
}

export interface MessageBubbleProps {
  message: Message;
  showTimestamp?: boolean;
  isGroupedWithPrevious?: boolean;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onHighlight?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

export function MessageBubble({
  message,
  showTimestamp = true,
  isGroupedWithPrevious = false,
  onReply,
  onEdit,
  onDelete,
  onHighlight,
  onReact,
}: MessageBubbleProps) {
  const { colors, radius } = useTheme();
  // Themed highlight tokens (matches the picker / honors the active theme).
  const highlightColors: Record<HighlightCategory, string> = {
    love: colors.highlightLove,
    funny: colors.highlightFunny,
    important: colors.highlightImportant,
    celebration: colors.highlightCelebration,
    milestone: colors.highlightMilestone,
    custom: colors.primary,
  };
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isSent = message.senderId === currentUserId;
  const emojiByName = useCustomEmojiStore((s) => s.byName);
  const loadCustomEmojis = useCustomEmojiStore((s) => s.load);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void loadCustomEmojis();
  }, [loadCustomEmojis]);

  // Deleted messages
  if (message.isDeleted) {
    return (
      <View style={[styles.line, { justifyContent: isSent ? 'flex-end' : 'flex-start' }]}>
        <View
          style={[
            styles.deletedBubble,
            { backgroundColor: colors.surfaceHover, borderColor: colors.border, borderRadius: radius.card },
          ]}
        >
          <AppText variant="caption" muted style={styles.italic}>
            This message was deleted
          </AppText>
        </View>
      </View>
    );
  }

  const highlightColor =
    message.isHighlighted && message.highlightCategory
      ? highlightColors[message.highlightCategory] ?? colors.primary
      : undefined;

  const bubbleBg = isSent ? colors.messageSent : colors.messageReceived;
  const bubbleText = isSent ? colors.messageSentText : colors.messageReceivedText;
  const subText = bubbleText + 'A6';

  const react = (emoji: string) => {
    onReact?.(message.id, emoji);
    setMenuOpen(false);
  };

  return (
    <>
      <View
        style={[
          styles.line,
          { justifyContent: isSent ? 'flex-end' : 'flex-start', marginTop: isGroupedWithPrevious ? 1 : 8 },
        ]}
      >
        <View style={styles.column}>
          {/* Thread indicator */}
          {message.threadReplyCount && message.threadReplyCount > 0 ? (
            <AppText variant="caption" color={colors.primary} style={styles.thread}>
              {message.threadReplyCount}{' '}
              {message.threadReplyCount === 1 ? 'reply' : 'replies'}
            </AppText>
          ) : null}

          <Pressable
            onLongPress={() => setMenuOpen(true)}
            delayLongPress={250}
            style={[
              styles.bubble,
              {
                backgroundColor: bubbleBg,
                borderRadius: radius.card,
                ...(highlightColor ? { borderWidth: 2, borderColor: highlightColor } : {}),
              },
            ]}
          >
            {/* Highlight note */}
            {message.isHighlighted && message.highlightNote ? (
              <View style={styles.noteRow}>
                <Star color={highlightColor} size={12} />
                <AppText variant="caption" color={highlightColor} weight="600">
                  {message.highlightNote}
                </AppText>
              </View>
            ) : null}

            {/* Media */}
            {message.mediaUrls && message.mediaUrls.length > 0 ? (
              <View
                style={
                  message.content && message.messageType !== 'voice'
                    ? styles.mediaWithText
                    : undefined
                }
              >
                <MediaMessage
                  mediaUrls={message.mediaUrls}
                  isSent={isSent}
                  messageType={message.messageType}
                />
              </View>
            ) : null}

            {/* Content (hidden for voice) */}
            {message.content && message.messageType !== 'voice' ? (
              <MessageText content={message.content} byName={emojiByName} color={bubbleText} />
            ) : null}

            {/* Edited + timestamp + status */}
            {showTimestamp ? (
              <View
                style={[
                  styles.metaRow,
                  { justifyContent: isSent ? 'flex-end' : 'flex-start' },
                ]}
              >
                {message.isEdited ? (
                  <AppText variant="caption" color={subText} style={styles.edited}>
                    (edited)
                  </AppText>
                ) : null}
                <AppText variant="caption" color={subText} style={styles.time}>
                  {formatTime(message.sentAt || message.createdAt)}
                </AppText>
                {isSent ? <StatusIcon status={message.status} color={subText} /> : null}
              </View>
            ) : null}
          </Pressable>

          {/* Reactions */}
          {message.reactions ? (
            <ReactionsDisplay
              reactions={message.reactions}
              align={isSent ? 'flex-end' : 'flex-start'}
            />
          ) : null}
        </View>
      </View>

      {/* Long-press action menu */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Animated.View
            entering={FadeIn.duration(150)}
            style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}
          >
            {/* Quick reactions — sticker pack */}
            <View style={styles.quickRow}>
              {STICKER_REACTIONS.slice(0, 6).map((val) => (
                <Pressable key={val} onPress={() => react(val)} style={styles.stickerBtn}>
                  <ReactionGlyph value={val} size={26} />
                </Pressable>
              ))}
            </View>

            {/* Full sticker grid */}
            <AppText variant="caption" muted weight="bold" style={styles.sectionLabel}>
              STICKERS
            </AppText>
            <View style={styles.gridWrap}>
              {STICKER_REACTIONS.map((val) => (
                <Pressable key={val} onPress={() => react(val)} style={styles.stickerCell}>
                  <ReactionGlyph value={val} size={26} />
                </Pressable>
              ))}
            </View>

            {/* Emoji grid */}
            <AppText variant="caption" muted weight="bold" style={styles.sectionLabel}>
              EMOJI
            </AppText>
            <ScrollView style={styles.emojiScroll} contentContainerStyle={styles.gridWrap}>
              {ALL_REACTIONS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => react(emoji)}
                  style={styles.emojiCell}
                >
                  <Emoji emoji={emoji} size={20} />
                </Pressable>
              ))}
            </ScrollView>

            {/* Message actions */}
            <View style={[styles.actionsBar, { borderTopColor: colors.border }]}>
              <ActionBtn
                icon={<Reply color={colors.text} size={18} />}
                label="Reply"
                onPress={() => {
                  onReply?.(message);
                  setMenuOpen(false);
                }}
              />
              {isSent ? (
                <ActionBtn
                  icon={<Pencil color={colors.text} size={18} />}
                  label="Edit"
                  onPress={() => {
                    onEdit?.(message);
                    setMenuOpen(false);
                  }}
                />
              ) : null}
              <ActionBtn
                icon={<Star color={colors.text} size={18} />}
                label="Highlight"
                onPress={() => {
                  onHighlight?.(message);
                  setMenuOpen(false);
                }}
              />
              {isSent ? (
                <ActionBtn
                  icon={<Trash2 color={colors.error} size={18} />}
                  label="Delete"
                  color={colors.error}
                  onPress={() => {
                    onDelete?.(message.id);
                    setMenuOpen(false);
                  }}
                />
              ) : null}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      {icon}
      <AppText variant="caption" color={color} weight="600">
        {label}
      </AppText>
    </Pressable>
  );
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', paddingHorizontal: 4 },
  column: { maxWidth: '78%' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8 },
  deletedBubble: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, maxWidth: '70%' },
  italic: { fontStyle: 'italic' },
  thread: { marginBottom: 2 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  mediaWithText: { marginBottom: 6 },
  inlineEmoji: { width: 18, height: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  edited: { fontSize: 10 },
  time: { fontSize: 10 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionCount: { fontSize: 11, fontWeight: '700' },
  // Menu
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.53)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  menu: {
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stickerBtn: {
    backgroundColor: '#ffffffF2',
    borderRadius: 10,
    padding: 4,
  },
  sectionLabel: { letterSpacing: 1.5, marginTop: 8, marginBottom: 4 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  stickerCell: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffffF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiScroll: { maxHeight: 140 },
  emojiCell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  actionBtn: { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
});
