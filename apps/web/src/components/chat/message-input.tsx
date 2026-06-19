'use client';

import {
  forwardRef,
  useRef,
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { Send, X, Pencil, Mic, Square, Trash2, Smile, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Emoji, QUICK_EMOJIS } from '@/components/ui';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useSocket } from '@/hooks/use-socket';
import api from '@/lib/api';
import { type CustomEmoji } from '@/components/emojis';

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

export const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
  (
    { onSend, onEditSend, onTypingStart, onTypingStop, partnerName, disabled },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isTyping, setIsTyping] = useState(false);

    const editingMessage = useChatStore((s) => s.editingMessage);
    const replyingTo = useChatStore((s) => s.replyingTo);
    const setEditingMessage = useChatStore((s) => s.setEditingMessage);
    const setReplyingTo = useChatStore((s) => s.setReplyingTo);

    const couple = useAuthStore((s) => s.couple);
    const { sendMessage } = useSocket();

    const [value, setValue] = useState('');

    // ─── Voice recording state ────────────────────────────────────────────
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const cancelledRef = useRef(false);
    const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [isUploadingVoice, setIsUploadingVoice] = useState(false);

    // ─── Emoji picker state ───────────────────────────────────────────────
    const emojiPanelRef = useRef<HTMLDivElement | null>(null);
    const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
    const [customEmojisLoaded, setCustomEmojisLoaded] = useState(false);
    const [loadingCustomEmojis, setLoadingCustomEmojis] = useState(false);

    // When editing, populate textarea with existing content
    useEffect(() => {
      if (editingMessage) {
        setValue(editingMessage.content);
        textareaRef.current?.focus();
      }
    }, [editingMessage]);

    // Auto-resize textarea
    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      const maxH = parseInt(
        getComputedStyle(textarea).getPropertyValue('--chat-input-max-height') || '200',
        10,
      );
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxH)}px`;
    }, []);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Typing indicator management
    const handleTypingStart = useCallback(() => {
      if (!isTyping) {
        setIsTyping(true);
        onTypingStart?.();
      }
      // Reset stop timer
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTypingStop?.();
      }, 2000);
    }, [isTyping, onTypingStart, onTypingStop]);

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (newValue.length <= MAX_CHARS) {
          setValue(newValue);
          if (newValue.length > 0) {
            handleTypingStart();
          }
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
        onSend(trimmed, replyingTo ? { threadId: replyingTo.id, isThreadStarter: false } : undefined);
        setReplyingTo(null);
      }

      setValue('');
      setIsTyping(false);
      onTypingStop?.();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Reset height
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      });
    }, [value, editingMessage, replyingTo, onSend, onEditSend, onTypingStop, setEditingMessage, setReplyingTo]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      },
      [handleSend],
    );

    const handleCancel = useCallback(() => {
      if (editingMessage) {
        setEditingMessage(null);
      } else {
        setReplyingTo(null);
      }
      setValue('');
    }, [editingMessage, setEditingMessage, setReplyingTo]);

    // Set ref
    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    // ─── Emoji insertion ──────────────────────────────────────────────────
    const insertAtCursor = useCallback((token: string) => {
      const textarea = textareaRef.current;
      setValue((prev) => {
        if (prev.length + token.length > MAX_CHARS) return prev;
        if (!textarea) return prev + token;
        const start = textarea.selectionStart ?? prev.length;
        const end = textarea.selectionEnd ?? prev.length;
        const next = prev.slice(0, start) + token + prev.slice(end);
        // Restore caret just after the inserted token on next frame
        requestAnimationFrame(() => {
          const pos = start + token.length;
          textarea.focus();
          try {
            textarea.setSelectionRange(pos, pos);
          } catch {
            /* ignore */
          }
        });
        return next;
      });
    }, []);

    const loadCustomEmojis = useCallback(async () => {
      if (customEmojisLoaded || loadingCustomEmojis) return;
      setLoadingCustomEmojis(true);
      try {
        const { data } = await api.get('/creative/emojis');
        setCustomEmojis((data?.data?.emojis ?? []) as CustomEmoji[]);
        setCustomEmojisLoaded(true);
      } catch {
        // Non-fatal — picker still shows unicode emojis
        setCustomEmojisLoaded(true);
      } finally {
        setLoadingCustomEmojis(false);
      }
    }, [customEmojisLoaded, loadingCustomEmojis]);

    const toggleEmojiPicker = useCallback(() => {
      setShowEmojiPicker((prev) => {
        const next = !prev;
        if (next) void loadCustomEmojis();
        return next;
      });
    }, [loadCustomEmojis]);

    // Close emoji picker on outside click
    useEffect(() => {
      if (!showEmojiPicker) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          emojiPanelRef.current?.contains(target) ||
          emojiButtonRef.current?.contains(target)
        ) {
          return;
        }
        setShowEmojiPicker(false);
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [showEmojiPicker]);

    // ─── Voice recording ──────────────────────────────────────────────────
    const cleanupRecording = useCallback(() => {
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setIsRecording(false);
      setElapsed(0);
    }, []);

    const uploadAndSendVoice = useCallback(
      async (blob: Blob) => {
        if (!couple?.id) {
          useToastStore.getState().push({
            title: 'Cannot send voice message',
            body: 'No active couple found.',
          });
          return;
        }
        setIsUploadingVoice(true);
        try {
          const file = new File([blob], `voice-${Date.now()}.webm`, {
            type: blob.type || 'audio/webm',
          });
          const formData = new FormData();
          formData.append('file', file);
          formData.append('coupleId', couple.id);
          formData.append('type', 'voice');

          const { data } = await api.post('/media/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          // The created media may be at data.data.media or data.data
          const media = data?.data?.media ?? data?.data;
          const url: string | undefined = media?.cdnUrl ?? media?.url;

          if (!url) {
            throw new Error('Upload succeeded but no URL was returned.');
          }

          sendMessage('🎤 Voice message', {
            messageType: 'voice',
            mediaUrls: [url],
          });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { error?: { message?: string } } } })
              .response?.data?.error?.message ??
            'Could not send your voice message. Please try again.';
          useToastStore.getState().push({ title: 'Voice message failed', body: message });
        } finally {
          setIsUploadingVoice(false);
        }
      },
      [couple?.id, sendMessage],
    );

    const startRecording = useCallback(async () => {
      if (isRecording || isUploadingVoice || disabled) return;
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined'
      ) {
        useToastStore.getState().push({
          title: 'Recording not supported',
          body: 'Your browser does not support voice recording.',
        });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        cancelledRef.current = false;
        chunksRef.current = [];

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const wasCancelled = cancelledRef.current;
          const chunks = chunksRef.current.slice();
          cleanupRecording();
          if (wasCancelled) return;
          if (chunks.length === 0) return;
          const blob = new Blob(chunks, {
            type: recorder.mimeType || 'audio/webm',
          });
          void uploadAndSendVoice(blob);
        };

        recorder.start();
        setIsRecording(true);
        setElapsed(0);
        elapsedTimerRef.current = setInterval(() => {
          setElapsed((s) => s + 1);
        }, 1000);
      } catch {
        // Permission denied or device error
        cleanupRecording();
        useToastStore.getState().push({
          title: 'Microphone access denied',
          body: 'Please allow microphone access to record a voice message.',
        });
      }
    }, [isRecording, isUploadingVoice, disabled, cleanupRecording, uploadAndSendVoice]);

    const stopRecording = useCallback(() => {
      cancelledRef.current = false;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        cleanupRecording();
      }
    }, [cleanupRecording]);

    const cancelRecording = useCallback(() => {
      cancelledRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        cleanupRecording();
      }
    }, [cleanupRecording]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      };
    }, []);

    const placeholder = partnerName
      ? `Message ${partnerName}...`
      : 'Type a message...';

    const hasText = value.trim().length > 0;
    // While recording, hide other actions; show recording controls instead.
    const showRecordingBar = isRecording;

    return (
      <div className="border-t border-border bg-surface px-4 py-3">
        {/* Reply / Edit banner */}
        {(replyingTo || editingMessage) && (
          <div className="flex items-center gap-2 mb-2 rounded-lg bg-surface-hover px-3 py-2 text-sm">
            {editingMessage ? (
              <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <div className="h-full w-0.5 rounded-full bg-primary shrink-0 self-stretch" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">
                {editingMessage ? 'Editing message' : 'Replying to'}
              </p>
              <p className="text-xs text-text-muted truncate">
                {(editingMessage || replyingTo)?.content}
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="shrink-0 p-1 rounded-full hover:bg-surface-active text-text-muted hover:text-text transition-colors"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Recording bar — replaces the input row while recording */}
        {showRecordingBar ? (
          <div className="flex items-center gap-3 rounded-full bg-background-alt border border-border px-4 py-2.5">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-error opacity-75 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-error" />
            </span>
            <span className="text-sm text-text font-medium tabular-nums">
              {formatElapsed(elapsed)}
            </span>
            <span className="flex-1 text-xs text-text-muted">Recording…</span>
            <button
              onClick={cancelRecording}
              className="flex items-center justify-center shrink-0 rounded-full w-9 h-9 bg-surface-hover text-text-muted hover:text-error transition-colors"
              aria-label="Cancel recording"
              title="Cancel"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center justify-center shrink-0 rounded-full w-10 h-10 bg-primary text-text-on-primary hover:bg-primary-hover shadow-sm transition-colors"
              aria-label="Stop and send recording"
              title="Stop & send"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {/* Emoji picker button + popover */}
            <div className="relative shrink-0">
              <button
                ref={emojiButtonRef}
                type="button"
                onClick={toggleEmojiPicker}
                disabled={disabled || isUploadingVoice}
                className={cn(
                  'flex items-center justify-center rounded-full w-10 h-10 transition-colors',
                  'text-text-muted hover:text-text hover:bg-surface-hover',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  showEmojiPicker && 'bg-surface-hover text-primary',
                )}
                aria-label="Insert emoji"
                aria-expanded={showEmojiPicker}
                title="Emoji"
              >
                <Smile className="h-5 w-5" />
              </button>

              {showEmojiPicker && (
                <div
                  ref={emojiPanelRef}
                  className="absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg p-3 z-30"
                  role="dialog"
                  aria-label="Emoji picker"
                >
                  {/* Common unicode emojis */}
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted mb-1.5">
                    Emojis
                  </p>
                  <div className="grid grid-cols-8 gap-1 mb-3">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertAtCursor(emoji)}
                        className="flex items-center justify-center rounded-md h-8 hover:bg-surface-hover transition-colors"
                        aria-label={`Insert ${emoji}`}
                      >
                        <Emoji emoji={emoji} size={22} />
                      </button>
                    ))}
                  </div>

                  {/* Custom emojis */}
                  <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted mb-1.5">
                    Your custom emojis
                  </p>
                  {loadingCustomEmojis ? (
                    <div className="flex items-center justify-center py-4 text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : customEmojis.length > 0 ? (
                    <div className="grid grid-cols-6 gap-1">
                      {customEmojis.map((emoji) => (
                        <button
                          key={emoji.id}
                          type="button"
                          onClick={() => insertAtCursor(`:${emoji.name}:`)}
                          className="flex items-center justify-center rounded-md h-9 p-1 hover:bg-surface-hover transition-colors"
                          aria-label={`Insert :${emoji.name}:`}
                          title={`:${emoji.name}:`}
                        >
                          <img
                            src={emoji.imageUrl}
                            alt={`:${emoji.name}:`}
                            className="h-6 w-6 object-contain"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted py-2">
                      No custom emojis yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div
              className="flex-1 relative"
              style={{
                borderRadius: 'var(--chat-input-radius)',
              }}
            >
              <textarea
                ref={setRefs}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled || isUploadingVoice}
                rows={1}
                className={cn(
                  'w-full resize-none bg-background-alt text-text placeholder:text-text-muted',
                  'px-4 py-2.5 text-sm leading-relaxed',
                  'border border-border focus:border-border-focus focus:ring-2 focus:ring-border-focus/20',
                  'focus:outline-none transition-all disabled:opacity-50',
                )}
                style={{
                  borderRadius: 'var(--chat-input-radius)',
                  minHeight: 'var(--chat-input-height)',
                  maxHeight: 'var(--chat-input-max-height)',
                }}
                aria-label={placeholder}
              />
            </div>

            {/* Mic button (shown when there's no text to send) */}
            {!hasText && !editingMessage && (
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled || isUploadingVoice}
                className={cn(
                  'flex items-center justify-center shrink-0 rounded-full w-10 h-10 transition-all',
                  'text-text-muted hover:text-text hover:bg-surface-hover',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                aria-label="Record voice message"
                title="Record voice message"
              >
                {isUploadingVoice ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>
            )}

            {/* Send button (shown when there's text or we're editing) */}
            {(hasText || editingMessage) && (
              <button
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                className={cn(
                  'flex items-center justify-center shrink-0 rounded-full',
                  'w-10 h-10 transition-all',
                  value.trim()
                    ? 'bg-primary text-text-on-primary hover:bg-primary-hover shadow-sm'
                    : 'bg-surface-hover text-text-muted cursor-not-allowed',
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Character count (near limit) */}
        {value.length > MAX_CHARS * 0.9 && (
          <p
            className={cn(
              'text-xs mt-1 text-right',
              value.length >= MAX_CHARS ? 'text-error' : 'text-text-muted',
            )}
          >
            {value.length}/{MAX_CHARS}
          </p>
        )}
      </div>
    );
  },
);

MessageInput.displayName = 'MessageInput';
