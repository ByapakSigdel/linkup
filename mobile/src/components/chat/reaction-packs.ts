// Ported from apps/web/src/lib/reaction-packs.ts.
// Per-theme quick-reaction packs + the full always-available picker set.

export const REACTION_PACKS: Record<string, string[]> = {
  default: ['❤️', '✨', '😍', '🥹', '🔥', '😂'],
  loveletter: ['❤️', '💌', '🥹', '😘', '🌹', '🕯️'],
  daybreak: ['❤️', '☀️', '😊', '🥰', '🌸', '👏'],
  brutalist: ['🔥', '💯', '😤', '👊', '⚡', '🤘'],
  minimal: ['🤍', '👍', '🙂', '✔️', '👀', '🙏'],
  arcade: ['👾', '🕹️', '🔥', '💚', '⭐', '😎'],
};

/** Quick-reaction set for the active theme (falls back to the default pack). */
export function reactionPack(themeId: string | undefined): string[] {
  return REACTION_PACKS[themeId ?? 'default'] ?? REACTION_PACKS.default!;
}

/** The full, always-available picker — pick any reaction regardless of theme. */
export const ALL_REACTIONS: string[] = [
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤',
  '😀', '😂', '🥹', '😍', '🥰', '😘', '😎', '🤩',
  '😭', '😡', '😤', '🙄', '😴', '🤔', '🫶', '🙏',
  '👍', '👎', '👏', '🙌', '👊', '🤘', '✌️', '🤙',
  '🔥', '✨', '⭐', '💯', '⚡', '🎉', '🎊', '💀',
  '🌹', '🌸', '☀️', '🌙', '👾', '🕹️', '🍕', '☕',
];

/** Quick-pick emoji for the message composer (from web ui/emoji.tsx). */
export const QUICK_EMOJIS: string[] = [
  '❤️', '😍', '😂', '🥰', '😘', '😎', '🤗', '😅',
  '🔥', '✨', '🌙', '⭐', '🎉', '🥹', '👍', '🙌',
  '💜', '💛', '💙', '🫶', '😊', '😴', '🥲', '🤍',
];
