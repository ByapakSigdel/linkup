import { View, StyleSheet, Pressable } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText } from '@/components/ui';
import { Emoji } from './stickers';
import type { HighlightCategory } from '@/types';

const HIGHLIGHT_DEFS: {
  category: HighlightCategory;
  label: string;
  emoji: string;
}[] = [
  { category: 'love', label: 'Love', emoji: '❤️' },
  { category: 'funny', label: 'Funny', emoji: '😂' },
  { category: 'important', label: 'Important', emoji: '❗' },
  { category: 'celebration', label: 'Celebration', emoji: '🎉' },
  { category: 'milestone', label: 'Milestone', emoji: '🏆' },
];

interface HighlightPickerProps {
  onSelect: (category: HighlightCategory, color: string) => void;
  onClose: () => void;
}

export function HighlightPicker({ onSelect, onClose }: HighlightPickerProps) {
  const { colors, radius } = useTheme();
  // Map each category to its themed highlight token so the picker honors the
  // active theme (the web hardcodes these; we use the equivalent tokens).
  const colorFor: Record<HighlightCategory, string> = {
    love: colors.highlightLove,
    funny: colors.highlightFunny,
    important: colors.highlightImportant,
    celebration: colors.highlightCelebration,
    milestone: colors.highlightMilestone,
    custom: colors.primary,
  };
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.card,
        },
      ]}
    >
      <View style={styles.header}>
        <Star color={colors.primary} size={16} />
        <AppText variant="label" weight="600">
          Highlight as...
        </AppText>
      </View>
      {HIGHLIGHT_DEFS.map((h) => (
        <Pressable
          key={h.category}
          onPress={() => {
            onSelect(h.category, colorFor[h.category]);
            onClose();
          }}
          style={({ pressed }) => [
            styles.option,
            {
              borderRadius: radius.button,
              backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: colorFor[h.category] }]} />
          <Emoji emoji={h.emoji} size={18} />
          <AppText variant="body">{h.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 12,
    minWidth: 220,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
