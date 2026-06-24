export type StarKind = 'shared' | 'guess' | 'custom';
export interface Star {
  id: string;
  coupleId: string;
  constellationKey: string;
  promptKey: string | null;
  kind: StarKind;
  title: string;
  status: 'pending' | 'lit';
  answers: Record<string, any>;
  photoUrl: string | null;
  posX: number;
  posY: number;
  createdBy: string;
  litAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Constellation { key: string; name: string; blurb: string; }
export interface Prompt {
  key: string; constellationKey: string; kind: 'shared' | 'guess';
  title: string; tier: 'warm' | 'deep' | 'spicy';
}
