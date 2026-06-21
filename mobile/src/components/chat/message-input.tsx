import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { Send, X, Pencil, Mic, Smile, Plus } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText, Spinner } from '@/components/ui';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useSocket } from '@/hooks/use-socket';
import { useMediaStore } from '@/stores/media-store';
import { QUICK_EMOJIS } from './reaction-packs';
import { Emoji } from './stickers';

const MAX_CHARS = 10000;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface MessageInputProps {
  onSend: (content: string, options?: { threadId?: string; isThreadStarter?: boolean }) => void;
  onEditSend?: (messageId: string, content: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  partnerName?: string;
  disabled?: boolean;
}

export function MessageInput({
  onSend,
  onEditSend,
  onTypingStart,
  onTypingStop,
  partnerName,
  disabled,
}: MessageInputProps) {
  const { colors, radius } = useTheme();
  const inputRef = useRef<TextInput | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [value, setValue] = useState('');

  const editingMessage = useChatStore((s) => s.editingMessage);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);

  const couple = useAuthStore((s) => s.couple);
  const { sendMessage } = useSocket();
  const uploadFile = useMediaStore((s) => s.uploadFile);

  const [showEmoji, setShowEmoji] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // ─── Voice recording (expo-audio) ───────────────────────────────────────────
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Populate input when editing
  useEffect(() => {
    if (editingMessage) {
      setValue(editingMessage.content);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  const handleTypingStart = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      onTypingStart?.();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTypingStop?.();
    }, 2000);
  }, [isTyping, onTypingStart, onTypingStop]);

  const handleChange = useCallback(
    (text: string) => {
      if (text.length <= MAX_CHARS) {
        setValue(text);
        if (text.length > 0) handleTypingStart();
      }
    },
    [handleTypingStart],
  );

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (editingMessage) {
      onEditSend?.(editingMessage.id, trimmed);
      setEditingMessage(null);
    } else {
      onSend(
        trimmed,
        replyingTo ? { threadId: replyingTo.id, isThreadStarter: false } : undefined,
      );
      setReplyingTo(null);
    }

    setValue('');
    setIsTyping(false);
    onTypingStop?.();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, [value, editingMessage, replyingTo, onSend, onEditSend, onTypingStop, setEditingMessage, setReplyingTo]);

  const handleCancel = useCallback(() => {
    if (editingMessage) setEditingMessage(null);
    else setReplyingTo(null);
    setValue('');
  }, [editingMessage, setEditingMessage, setReplyingTo]);

  const insertEmoji = useCallback((token: string) => {
    setValue((prev) => (prev.length + token.length > MAX_CHARS ? prev : prev + token));
    handleTypingStart();
  }, [handleTypingStart]);

  // ─── Attach (image / video) ──────────────────────────────────────────────────
  const handleAttach = useCallback(async () => {
    if (!couple?.id || attaching || isUploadingVoice) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      useToastStore.getState().push({
        title: 'Permission needed',
        body: 'Allow photo access to share media.',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setAttaching(true);
    try {
      const isVideo = asset.type === 'video';
      const name =
        asset.fileName ?? `attachment-${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
      const type = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
      const media = await uploadFile(couple.id, { uri: asset.uri, name, type });
      const url = media?.cdnUrl ?? null;
      if (!url) throw new Error('No URL returned');
      sendMessage(value.trim() || '', {
        messageType: isVideo ? 'video' : 'photo',
        mediaUrls: [url],
      });
      setValue('');
    } catch {
      useToastStore.getState().push({
        title: 'Upload failed',
        body: 'Could not share that media. Please try again.',
      });
    } finally {
      setAttaching(false);
    }
  }, [couple?.id, attaching, isUploadingVoice, uploadFile, sendMessage, value]);

  // ─── Voice recording ─────────────────────────────────────────────────────────
  const cleanupTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setElapsed(0);
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isUploadingVoice || disabled) return;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      useToastStore.getState().push({
        title: 'Microphone access denied',
        body: 'Allow microphone access to record a voice message.',
      });
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setElapsed(0);
      elapsedTimerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      cleanupTimer();
      setIsRecording(false);
      useToastStore.getState().push({
        title: 'Recording failed',
        body: 'Could not start the recorder.',
      });
    }
  }, [isRecording, isUploadingVoice, disabled, recorder, cleanupTimer]);

  const finishRecording = useCallback(
    async (cancelled: boolean) => {
      cleanupTimer();
      setIsRecording(false);
      try {
        await recorder.stop();
      } catch {
        /* ignore */
      }
      const uri = recorder.uri;
      if (cancelled || !uri || !couple?.id) return;
      setIsUploadingVoice(true);
      try {
        const media = await uploadFile(couple.id, {
          uri,
          name: `voice-${Date.now()}.m4a`,
          type: 'audio/m4a',
        });
        const url = media?.cdnUrl ?? null;
        if (!url) throw new Error('No URL returned');
        sendMessage('🎤 Voice message', { messageType: 'voice', mediaUrls: [url] });
      } catch {
        useToastStore.getState().push({
          title: 'Voice message failed',
          body: 'Could not send your voice message. Please try again.',
        });
      } finally {
        setIsUploadingVoice(false);
      }
    },
    [recorder, couple?.id, uploadFile, sendMessage, cleanupTimer],
  );

  useEffect(() => {
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const placeholder = partnerName ? `Message ${partnerName}...` : 'Type a message...';
  const hasText = value.trim().length > 0;

  return (
    <View style={[styles.wrap, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
      {/* Reply / Edit banner */}
      {(replyingTo || editingMessage) && (
        <View style={[styles.banner, { backgroundColor: colors.surfaceHover, borderRadius: radius.input }]}>
          {editingMessage ? (
            <Pencil color={colors.primary} size={14} />
          ) : (
            <View style={[styles.bannerBar, { backgroundColor: colors.primary }]} />
          )}
          <View style={styles.bannerBody}>
            <AppText variant="caption" color={colors.primary} weight="600">
              {editingMessage ? 'Editing message' : 'Replying to'}
            </AppText>
            <AppText variant="caption" muted numberOfLines={1}>
              {(editingMessage || replyingTo)?.content}
            </AppText>
          </View>
          <Pressable onPress={handleCancel} hitSlop={8}>
            <X color={colors.textMuted} size={16} />
          </Pressable>
        </View>
      )}

      {/* Emoji panel */}
      {showEmoji && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.emojiPanel}
          contentContainerStyle={styles.emojiPanelContent}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <Pressable key={emoji} onPress={() => insertEmoji(emoji)} style={styles.emojiBtn}>
              <Emoji emoji={emoji} size={24} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {isRecording ? (
        <View style={[styles.recordBar, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]}>
          <View style={[styles.recDot, { backgroundColor: colors.error }]} />
          <AppText variant="body" weight="600">{formatElapsed(elapsed)}</AppText>
          <AppText variant="caption" muted style={styles.recLabel}>Recording…</AppText>
          <Pressable onPress={() => finishRecording(true)} hitSlop={8} style={styles.recBtn}>
            <X color={colors.textMuted} size={20} />
          </Pressable>
          <Pressable
            onPress={() => finishRecording(false)}
            hitSlop={8}
            style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          >
            <Send color={colors.textOnPrimary} size={18} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <Pressable
            onPress={() => setShowEmoji((v) => !v)}
            disabled={disabled || isUploadingVoice}
            style={styles.circleBtn}
            accessibilityLabel="Insert emoji"
          >
            <Smile color={showEmoji ? colors.primary : colors.textMuted} size={22} />
          </Pressable>

          <Pressable
            onPress={handleAttach}
            disabled={disabled || attaching || isUploadingVoice}
            style={styles.circleBtn}
            accessibilityLabel="Attach media"
          >
            {attaching ? <Spinner size="small" /> : <Plus color={colors.textMuted} size={22} />}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChange}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            editable={!disabled && !isUploadingVoice}
            multiline
            style={[
              styles.input,
              {
                backgroundColor: colors.backgroundAlt,
                color: colors.text,
                borderColor: colors.border,
                borderRadius: radius.input,
              },
            ]}
          />

          {!hasText && !editingMessage ? (
            <Pressable
              onPress={startRecording}
              disabled={disabled || isUploadingVoice}
              style={styles.circleBtn}
              accessibilityLabel="Record voice message"
            >
              {isUploadingVoice ? <Spinner size="small" /> : <Mic color={colors.textMuted} size={22} />}
            </Pressable>
          ) : (
            <Pressable
              onPress={handleSend}
              disabled={disabled || !hasText}
              style={[
                styles.sendBtn,
                { backgroundColor: hasText ? colors.primary : colors.surfaceHover },
              ]}
              accessibilityLabel="Send message"
            >
              <Send color={hasText ? colors.textOnPrimary : colors.textMuted} size={18} />
            </Pressable>
          )}
        </View>
      )}

      {value.length > MAX_CHARS * 0.9 ? (
        <AppText
          variant="caption"
          color={value.length >= MAX_CHARS ? colors.error : colors.textMuted}
          style={styles.charCount}
        >
          {value.length}/{MAX_CHARS}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, marginBottom: 8 },
  bannerBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  bannerBody: { flex: 1, minWidth: 0 },
  emojiPanel: { maxHeight: 48, marginBottom: 8 },
  emojiPanelContent: { gap: 6, paddingHorizontal: 2, alignItems: 'center' },
  emojiBtn: { padding: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  recordBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recDot: { width: 12, height: 12, borderRadius: 6 },
  recLabel: { flex: 1 },
  recBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  charCount: { textAlign: 'right', marginTop: 4 },
});
