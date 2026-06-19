// Per-theme quick-reaction packs. Each theme surfaces a different default set
// (in priority order) that matches its vibe — but every reaction is still
// selectable via the full picker (ALL_REACTIONS).

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
