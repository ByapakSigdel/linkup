'use client';

import { Emoji } from '@/components/ui';

/**
 * Original sticker reactions — crisp vector "void cat" pack, drawn from scratch
 * (no third-party/watermarked assets). Reaction values are stored as plain
 * strings in the existing reaction pipeline, prefixed with `st:` so the renderer
 * knows to draw a sticker instead of a unicode emoji.
 */
export const STICKER_PREFIX = 'st:';

const INK = '#17171c';

// Shared cat silhouette (two ears + a loaf body). Faces are layered on top.
function Base() {
  return (
    <>
      <path d="M15 31 12 17 27 27Z" fill={INK} />
      <path d="M49 31 52 17 37 27Z" fill={INK} />
      <path
        d="M9 47c0-14 10-21 23-21s23 7 23 21v1c0 3-2 5-5 5H14c-3 0-5-2-5-5z"
        fill={INK}
      />
    </>
  );
}

type StickerDef = { label: string; render: () => React.ReactNode };

const STICKERS: Record<string, StickerDef> = {
  loaf: {
    label: 'cat',
    render: () => (
      <>
        <Base />
        <ellipse cx="25" cy="41" rx="3.1" ry="4.1" fill="#fff" />
        <ellipse cx="39" cy="41" rx="3.1" ry="4.1" fill="#fff" />
        <circle cx="25.5" cy="42" r="1.3" fill={INK} />
        <circle cx="38.5" cy="42" r="1.3" fill={INK} />
      </>
    ),
  },
  happy: {
    label: 'happy cat',
    render: () => (
      <>
        <Base />
        <path
          d="M21 42 Q25 37 29 42M35 42 Q39 37 43 42"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M29 47 Q32 50 35 47"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  love: {
    label: 'cat in love',
    render: () => (
      <>
        <Base />
        <path
          d="M21 42 Q25 37 29 42M35 42 Q39 37 43 42"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M32 9c-1.6-3-6-2.6-6 .8 0 2.6 6 6 6 6s6-3.4 6-6c0-3.4-4.4-3.8-6-.8z"
          fill="#ff5277"
        />
      </>
    ),
  },
  wow: {
    label: 'surprised cat',
    render: () => (
      <>
        <Base />
        <circle cx="25" cy="41" r="4.6" fill="#fff" />
        <circle cx="39" cy="41" r="4.6" fill="#fff" />
        <circle cx="25" cy="41.5" r="2" fill={INK} />
        <circle cx="39" cy="41.5" r="2" fill={INK} />
        <ellipse cx="32" cy="49" rx="1.8" ry="2.4" fill="#fff" />
      </>
    ),
  },
  sleep: {
    label: 'sleeping cat',
    render: () => (
      <>
        <Base />
        <path
          d="M21 41 Q25 45 29 41M35 41 Q39 45 43 41"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M45 14h6l-6 7h6"
          stroke={INK}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    ),
  },
  grumpy: {
    label: 'grumpy cat',
    render: () => (
      <>
        <Base />
        <rect x="21" y="40" width="8" height="2.4" rx="1.2" fill="#fff" />
        <rect x="35" y="40" width="8" height="2.4" rx="1.2" fill="#fff" />
        <path
          d="M28 48 H36"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
  },
  scared: {
    label: 'startled cat',
    render: () => (
      <>
        {/* spiky fur on top of the loaf */}
        <path
          d="M16 30 19 22 23 29 27 21 31 29 35 21 39 29 43 22 47 30Z"
          fill={INK}
        />
        <path d="M15 31 12 17 27 27Z" fill={INK} />
        <path d="M49 31 52 17 37 27Z" fill={INK} />
        <path
          d="M9 47c0-14 10-21 23-21s23 7 23 21v1c0 3-2 5-5 5H14c-3 0-5-2-5-5z"
          fill={INK}
        />
        <circle cx="25" cy="42" r="4.4" fill="#fff" />
        <circle cx="39" cy="42" r="4.4" fill="#fff" />
        <circle cx="25" cy="42.5" r="1.8" fill={INK} />
        <circle cx="39" cy="42.5" r="1.8" fill={INK} />
      </>
    ),
  },
  peek: {
    label: 'peeking cat',
    render: () => (
      <>
        {/* head + ears poking up */}
        <path d="M19 30 16 18 30 28Z" fill={INK} />
        <path d="M45 30 48 18 34 28Z" fill={INK} />
        <path d="M16 38c0-10 7-15 16-15s16 5 16 15z" fill={INK} />
        <circle cx="26" cy="33" r="3" fill="#fff" />
        <circle cx="38" cy="33" r="3" fill="#fff" />
        <circle cx="26.5" cy="33.5" r="1.2" fill={INK} />
        <circle cx="37.5" cy="33.5" r="1.2" fill={INK} />
        {/* the wall/edge it peeks over */}
        <rect x="6" y="40" width="52" height="16" rx="4" fill={INK} />
      </>
    ),
  },
};

export const STICKER_KEYS = Object.keys(STICKERS);
/** Full reaction values (with prefix) for pickers/quick-bars. */
export const STICKER_REACTIONS = STICKER_KEYS.map((k) => STICKER_PREFIX + k);

export function isSticker(value: string): boolean {
  return value.startsWith(STICKER_PREFIX) && STICKERS[value.slice(STICKER_PREFIX.length)] !== undefined;
}

/** Render a single sticker by its (prefixed or bare) key. */
export function Sticker({ value, size = 24 }: { value: string; size?: number }) {
  const key = value.startsWith(STICKER_PREFIX)
    ? value.slice(STICKER_PREFIX.length)
    : value;
  const def = STICKERS[key];
  if (!def) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={def.label}
    >
      {def.render()}
    </svg>
  );
}

/** Render any reaction value: a sticker if it's a known sticker, else a Twemoji. */
export function ReactionGlyph({ value, size = 20 }: { value: string; size?: number }) {
  if (isSticker(value)) return <Sticker value={value} size={size} />;
  return <Emoji emoji={value} size={size} />;
}
