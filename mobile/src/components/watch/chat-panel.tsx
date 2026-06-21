import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { MessageCircle, Send } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText } from '@/components/ui';
import type { ChatMessage } from './types';

export const WATCH_REACTIONS = ['😂', '❤️', '😮', '🔥', '👏', '😢'] as const;

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onReact: (emoji: string) => void;
  disabled?: boolean;
}

export function ChatPanel({ messages, onSend, onReact, disabled }: ChatPanelProps) {
  const { colors, radius } = useTheme();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      // Wait for the new row to mount before scrolling.
      const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      return () => clearTimeout(t);
    }
  }, [messages.length]);

  function handleSubmit() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  }

  const canSend = !disabled && !!text.trim();

  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <MessageCircle color={colors.accent} size={16} />
        <AppText variant="label">Watch chat</AppText>
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <AppText muted center variant="body">
            Say something while you watch together.
          </AppText>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m }) => (
            <View style={{ alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
              <AppText
                variant="caption"
                muted
                style={{ marginBottom: 2, marginHorizontal: 4, fontSize: 10, letterSpacing: 0.5 }}
              >
                {m.mine ? 'YOU' : 'PARTNER'}
              </AppText>
              <View
                style={{
                  maxWidth: '85%',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 16,
                  borderBottomRightRadius: m.mine ? 4 : 16,
                  borderBottomLeftRadius: m.mine ? 16 : 4,
                  backgroundColor: m.mine ? colors.primary : colors.surfaceHover,
                }}
              >
                <AppText
                  variant="body"
                  color={m.mine ? colors.textOnPrimary : colors.text}
                >
                  {m.text}
                </AppText>
              </View>
            </View>
          )}
        />
      )}

      {/* Reactions */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        {WATCH_REACTIONS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => onReact(emoji)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`React ${emoji}`}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.surfaceHover : 'transparent',
              opacity: disabled ? 0.4 : 1,
            })}
          >
            <AppText style={{ fontSize: 20 }}>{emoji}</AppText>
          </Pressable>
        ))}
      </View>

      {/* Composer */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          padding: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          editable={!disabled}
          placeholder={disabled ? 'Start a party to chat' : 'Message…'}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          style={{
            flex: 1,
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.input,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 15,
            color: colors.text,
          }}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            opacity: !canSend ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          <Send color={colors.textOnPrimary} size={18} />
        </Pressable>
      </View>
    </View>
  );
}
