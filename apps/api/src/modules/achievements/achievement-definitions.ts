/**
 * Built-in achievement definitions. Seeded into the `achievements` table on
 * module init. `requirements.type` maps to a metric computed in AchievementsService.
 */
export interface AchievementDef {
  code: string;
  category: string;
  name: string;
  description: string;
  icon: string; // emoji used as iconUrl placeholder
  requirements: { type: string; threshold: number };
  points: number;
  rarity: string;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  // ── Communication ──
  { code: 'first_words', category: 'communication', name: 'First Words', description: 'Send your very first message together.', icon: '💬', requirements: { type: 'messages', threshold: 1 }, points: 10, rarity: 'common' },
  { code: 'chatterbox', category: 'communication', name: 'Chatterbox', description: 'Exchange 100 messages.', icon: '🗨️', requirements: { type: 'messages', threshold: 100 }, points: 50, rarity: 'uncommon' },
  { code: 'conversation_master', category: 'communication', name: 'Conversation Master', description: 'Exchange 1,000 messages.', icon: '📣', requirements: { type: 'messages', threshold: 1000 }, points: 200, rarity: 'rare' },
  { code: 'never_silent', category: 'communication', name: 'Never Silent', description: 'Exchange 10,000 messages.', icon: '🎙️', requirements: { type: 'messages', threshold: 10000 }, points: 1000, rarity: 'legendary' },

  // ── Memories / Media ──
  { code: 'first_snapshot', category: 'memories', name: 'First Snapshot', description: 'Share your first photo or video.', icon: '📸', requirements: { type: 'media', threshold: 1 }, points: 10, rarity: 'common' },
  { code: 'shutterbug', category: 'memories', name: 'Shutterbug', description: 'Share 50 pieces of media.', icon: '🖼️', requirements: { type: 'media', threshold: 50 }, points: 75, rarity: 'uncommon' },
  { code: 'memory_keeper', category: 'memories', name: 'Memory Keeper', description: 'Share 500 pieces of media.', icon: '🗃️', requirements: { type: 'media', threshold: 500 }, points: 300, rarity: 'epic' },
  { code: 'first_highlight', category: 'memories', name: 'Worth Remembering', description: 'Highlight your first special message.', icon: '⭐', requirements: { type: 'highlights', threshold: 1 }, points: 15, rarity: 'common' },
  { code: 'hall_of_famer', category: 'memories', name: 'Hall of Famer', description: 'Highlight 25 special moments.', icon: '🏆', requirements: { type: 'highlights', threshold: 25 }, points: 100, rarity: 'rare' },

  // ── Streaks ──
  { code: 'streak_week', category: 'streaks', name: 'On a Roll', description: 'Reach a 7-day photo streak.', icon: '🔥', requirements: { type: 'streak_longest', threshold: 7 }, points: 50, rarity: 'uncommon' },
  { code: 'streak_month', category: 'streaks', name: 'Inseparable', description: 'Reach a 30-day photo streak.', icon: '🔥', requirements: { type: 'streak_longest', threshold: 30 }, points: 200, rarity: 'rare' },
  { code: 'streak_century', category: 'streaks', name: 'Centurions', description: 'Reach a 100-day photo streak.', icon: '💯', requirements: { type: 'streak_longest', threshold: 100 }, points: 1000, rarity: 'epic' },
  { code: 'streak_year', category: 'streaks', name: 'Eternal Flame', description: 'Reach a 365-day photo streak.', icon: '🌟', requirements: { type: 'streak_longest', threshold: 365 }, points: 5000, rarity: 'legendary' },

  // ── Time together ──
  { code: 'week_one', category: 'time_based', name: 'One Week In', description: 'Spend a week together on LinkUp.', icon: '🗓️', requirements: { type: 'days_together', threshold: 7 }, points: 20, rarity: 'common' },
  { code: 'one_month', category: 'time_based', name: 'One Month Strong', description: 'Spend a month together.', icon: '📅', requirements: { type: 'days_together', threshold: 30 }, points: 75, rarity: 'uncommon' },
  { code: 'hundred_days', category: 'time_based', name: '100 Days', description: 'Celebrate 100 days together.', icon: '🎉', requirements: { type: 'days_together', threshold: 100 }, points: 250, rarity: 'rare' },
  { code: 'one_year', category: 'time_based', name: 'One Year of Us', description: 'Celebrate a full year together.', icon: '💍', requirements: { type: 'days_together', threshold: 365 }, points: 2000, rarity: 'legendary' },

  // ── Creative ──
  { code: 'first_creation', category: 'creative', name: 'Creative Spark', description: 'Make your first scribble, painting, or custom emoji.', icon: '🎨', requirements: { type: 'creative_items', threshold: 1 }, points: 20, rarity: 'common' },
  { code: 'artist_duo', category: 'creative', name: 'Artist Duo', description: 'Create 20 creative works together.', icon: '🖌️', requirements: { type: 'creative_items', threshold: 20 }, points: 150, rarity: 'rare' },

  // ── Social ──
  { code: 'social_first', category: 'social', name: 'Plus One', description: 'Add your first single friend.', icon: '🤝', requirements: { type: 'friends', threshold: 1 }, points: 25, rarity: 'common' },
  { code: 'circle_starter', category: 'social', name: 'Better Together', description: 'Join or create your first couple circle.', icon: '👥', requirements: { type: 'circles', threshold: 1 }, points: 25, rarity: 'common' },
];
