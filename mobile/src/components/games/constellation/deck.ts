import type { Constellation, Prompt } from './types';

export const CONSTELLATIONS: Constellation[] = [
  { key: 'firsts', name: 'Firsts', blurb: 'Where it all began.' },
  { key: 'inside_jokes', name: 'Inside Jokes', blurb: "Things only you two get." },
  { key: 'little_things', name: 'Little Things', blurb: 'The small stuff that is everything.' },
  { key: 'what_i_admire', name: 'What I Admire', blurb: 'What I see in you.' },
  { key: 'dreams', name: 'Dreams', blurb: 'Where we are headed.' },
  { key: 'hard_times', name: 'Hard Times We Survived', blurb: 'Storms we weathered.' },
  { key: 'just_us', name: 'Just Us', blurb: 'For your eyes only.' },
];

export const PROMPTS: Prompt[] = [
  // Firsts
  { key: 'firsts_met', constellationKey: 'firsts', kind: 'shared', tier: 'warm', title: 'Where did we first meet — and what do you remember?' },
  { key: 'firsts_impression', constellationKey: 'firsts', kind: 'guess', tier: 'warm', title: 'What was my very first impression of you?' },
  { key: 'firsts_date', constellationKey: 'firsts', kind: 'shared', tier: 'warm', title: 'Our first date — describe it in your words.' },
  { key: 'firsts_iloveyou', constellationKey: 'firsts', kind: 'shared', tier: 'deep', title: 'The first "I love you" — who, when, where?' },
  { key: 'firsts_trip', constellationKey: 'firsts', kind: 'shared', tier: 'warm', title: 'Our first trip together.' },
  { key: 'firsts_song', constellationKey: 'firsts', kind: 'guess', tier: 'warm', title: 'What would you say is "our song"?' },
  // Inside Jokes
  { key: 'jokes_phrase', constellationKey: 'inside_jokes', kind: 'shared', tier: 'warm', title: 'A phrase only we understand — and its origin.' },
  { key: 'jokes_nickname', constellationKey: 'inside_jokes', kind: 'shared', tier: 'warm', title: 'The story behind a nickname.' },
  { key: 'jokes_funniest', constellationKey: 'inside_jokes', kind: 'shared', tier: 'warm', title: 'The funniest thing that ever happened to us.' },
  { key: 'jokes_cant_explain', constellationKey: 'inside_jokes', kind: 'shared', tier: 'warm', title: 'Something we find hilarious that no one else does.' },
  { key: 'jokes_meme', constellationKey: 'inside_jokes', kind: 'guess', tier: 'warm', title: 'What meme/gif is SO us?' },
  // Little Things
  { key: 'little_coffee', constellationKey: 'little_things', kind: 'guess', tier: 'warm', title: 'Exactly how do I take my coffee/tea?' },
  { key: 'little_comfort', constellationKey: 'little_things', kind: 'guess', tier: 'warm', title: 'My ultimate comfort food?' },
  { key: 'little_lovelang', constellationKey: 'little_things', kind: 'guess', tier: 'deep', title: 'What is my love language?' },
  { key: 'little_badday', constellationKey: 'little_things', kind: 'guess', tier: 'deep', title: 'What cheers me up on a bad day?' },
  { key: 'little_habit', constellationKey: 'little_things', kind: 'shared', tier: 'warm', title: 'A small habit of yours I secretly adore.' },
  { key: 'little_sound', constellationKey: 'little_things', kind: 'guess', tier: 'warm', title: 'A sound or smell that reminds me of you?' },
  // What I Admire
  { key: 'admire_better', constellationKey: 'what_i_admire', kind: 'shared', tier: 'warm', title: 'Something you are better at than me.' },
  { key: 'admire_proud', constellationKey: 'what_i_admire', kind: 'shared', tier: 'deep', title: 'A moment I was really proud of you.' },
  { key: 'admire_quality', constellationKey: 'what_i_admire', kind: 'shared', tier: 'deep', title: 'A quality of yours I want to grow in myself.' },
  { key: 'admire_strength', constellationKey: 'what_i_admire', kind: 'guess', tier: 'deep', title: 'What do you think I most admire about you?' },
  { key: 'admire_changed', constellationKey: 'what_i_admire', kind: 'shared', tier: 'deep', title: 'How you have changed me for the better.' },
  // Dreams
  { key: 'dreams_place', constellationKey: 'dreams', kind: 'shared', tier: 'warm', title: 'A place we MUST go together.' },
  { key: 'dreams_fiveyears', constellationKey: 'dreams', kind: 'shared', tier: 'deep', title: 'Where do you hope we are in 5 years?' },
  { key: 'dreams_build', constellationKey: 'dreams', kind: 'shared', tier: 'deep', title: 'Something we should build or do together.' },
  { key: 'dreams_tradition', constellationKey: 'dreams', kind: 'shared', tier: 'warm', title: 'A tradition you want us to start.' },
  { key: 'dreams_perfectday', constellationKey: 'dreams', kind: 'guess', tier: 'warm', title: 'Describe my perfect lazy day.' },
  // Hard Times We Survived
  { key: 'hard_fight', constellationKey: 'hard_times', kind: 'shared', tier: 'deep', title: 'A disagreement that ended up making us stronger.' },
  { key: 'hard_showedup', constellationKey: 'hard_times', kind: 'shared', tier: 'deep', title: 'A time you showed up for me when it mattered.' },
  { key: 'hard_scared', constellationKey: 'hard_times', kind: 'shared', tier: 'deep', title: 'Something hard we got through together.' },
  { key: 'hard_grateful', constellationKey: 'hard_times', kind: 'shared', tier: 'deep', title: 'Something about you I am grateful for but rarely say.' },
  // Just Us (spicy)
  { key: 'just_attracted', constellationKey: 'just_us', kind: 'guess', tier: 'spicy', title: 'What first physically drew me to you?' },
  { key: 'just_favmoment', constellationKey: 'just_us', kind: 'shared', tier: 'spicy', title: 'A favourite intimate memory of us.' },
  { key: 'just_turnson', constellationKey: 'just_us', kind: 'guess', tier: 'spicy', title: 'Guess one thing that makes me weak for you.' },
  { key: 'just_fantasy', constellationKey: 'just_us', kind: 'shared', tier: 'spicy', title: 'A little fantasy or wish for us.' },
];

export function promptsFor(constellationKey: string): Prompt[] {
  return PROMPTS.filter((p) => p.constellationKey === constellationKey);
}

/** Deterministic daily prompt: stable per (coupleId, date), skips already-lit prompts. */
export function dailyPrompt(coupleId: string, dateISO: string, litKeys: string[]): Prompt | null {
  const pool = PROMPTS.filter((p) => !litKeys.includes(p.key));
  if (pool.length === 0) return null;
  const seed = `${coupleId}:${dateISO}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length] ?? null;
}
