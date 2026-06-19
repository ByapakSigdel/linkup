import { create } from 'zustand';

interface GamesState {
  /** The game key the partner is currently in (their open game), or null. */
  partnerInGame: string | null;
  /** The game key I'm currently in, or null (used to answer presence pings). */
  myGame: string | null;
  setPartnerInGame: (game: string | null) => void;
  setMyGame: (game: string | null) => void;
}

export const useGamesStore = create<GamesState>((set) => ({
  partnerInGame: null,
  myGame: null,
  setPartnerInGame: (game) => set({ partnerInGame: game }),
  setMyGame: (game) => set({ myGame: game }),
}));
