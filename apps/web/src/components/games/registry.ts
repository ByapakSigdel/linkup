import type { ComponentType } from 'react';
import { TicTacToe } from './tic-tac-toe';
import { ConnectFour } from './connect-four';
import { RockPaperScissors } from './rock-paper-scissors';
import { WouldYouRather } from './would-you-rather';
import { PartnerQuiz } from './partner-quiz';
import { TruthOrDare } from './truth-or-dare';
import { MemoryMatch } from './memory-match';
import { Pictionary } from './pictionary';
import { DiceDuel } from './dice-duel';

export type GameCategory = 'classic' | 'couple' | 'creative' | 'luck';

export interface GameDef {
  key: string;
  name: string;
  tagline: string;
  emoji: string;
  category: GameCategory;
  Component: ComponentType;
}

export const CATEGORY_LABELS: Record<GameCategory, string> = {
  classic: 'Head to head',
  couple: 'Just the two of you',
  creative: 'Draw & guess',
  luck: 'Memory & luck',
};

export const GAMES: GameDef[] = [
  { key: 'tic-tac-toe', name: 'Tic-Tac-Toe', tagline: 'Three in a row', emoji: '⭕', category: 'classic', Component: TicTacToe },
  { key: 'connect-four', name: 'Connect Four', tagline: 'Line up four', emoji: '🔵', category: 'classic', Component: ConnectFour },
  { key: 'rock-paper-scissors', name: 'Rock Paper Scissors', tagline: 'Best of five', emoji: '✊', category: 'classic', Component: RockPaperScissors },
  { key: 'would-you-rather', name: 'Would You Rather', tagline: 'Do your answers match?', emoji: '🤔', category: 'couple', Component: WouldYouRather },
  { key: 'partner-quiz', name: 'How Well Do You Know Me', tagline: 'Guess each other', emoji: '💞', category: 'couple', Component: PartnerQuiz },
  { key: 'truth-or-dare', name: 'Truth or Dare', tagline: 'Spin and dare', emoji: '🎯', category: 'couple', Component: TruthOrDare },
  { key: 'memory-match', name: 'Memory Match', tagline: 'Find the pairs', emoji: '🧠', category: 'luck', Component: MemoryMatch },
  { key: 'pictionary', name: 'Pictionary', tagline: 'One draws, one guesses', emoji: '🎨', category: 'creative', Component: Pictionary },
  { key: 'dice-duel', name: 'Dice Duel', tagline: 'Highest roll wins', emoji: '🎲', category: 'luck', Component: DiceDuel },
];

export const getGame = (key: string): GameDef | undefined =>
  GAMES.find((g) => g.key === key);
