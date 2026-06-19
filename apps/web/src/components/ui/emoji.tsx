'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

const U200D = String.fromCharCode(0x200d);
const UFE0F = /️/g;

function toCodePoint(unicode: string): string {
  const r: string[] = [];
  let p = 0;
  let i = 0;
  while (i < unicode.length) {
    const c = unicode.charCodeAt(i++);
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      p = 0;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }
  return r.join('-');
}

function codepoint(emoji: string): string {
  return toCodePoint(
    emoji.indexOf(U200D) < 0 ? emoji.replace(UFE0F, '') : emoji,
  );
}

const CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg';

/**
 * Renders a unicode emoji as a consistent Twemoji SVG so it looks designed and
 * identical on every platform — never the OS's default glyph. Falls back to the
 * raw glyph if the asset can't load (e.g. offline).
 */
export function Emoji({
  emoji,
  size = 20,
  className,
  label,
}: {
  emoji: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  const [failed, setFailed] = useState(false);
  const code = codepoint(emoji);

  if (failed || !code) {
    return (
      <span
        role="img"
        aria-label={label || emoji}
        className={cn('inline-block leading-none', className)}
        style={{ fontSize: size }}
      >
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`${CDN}/${code}.svg`}
      alt={label || emoji}
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('inline-block select-none align-[-0.15em]', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Curated reaction set used across chat, watch party, etc. */
export const REACTION_EMOJIS = [
  '❤️',
  '😍',
  '😂',
  '🥰',
  '😘',
  '🔥',
  '✨',
  '👍',
  '🎉',
  '😢',
  '😮',
  '🙏',
] as const;

/** Quick-pick emoji for the message composer. */
export const QUICK_EMOJIS = [
  '❤️', '😍', '😂', '🥰', '😘', '😎', '🤗', '😅',
  '🔥', '✨', '🌙', '⭐', '🎉', '🥹', '👍', '🙌',
  '💜', '💛', '💙', '🫶', '😊', '😴', '🥲', '🤍',
] as const;
