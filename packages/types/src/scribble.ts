// ============================================
// Scribble & Creative Types
// ============================================

export interface Scribble {
  id: string;
  coupleId: string;

  // Canvas
  canvasSize: { width: number; height: number };
  backgroundColor: string;
  backgroundTemplate?: 'grid' | 'dots' | 'lined' | 'blank';

  // Drawing data
  strokes: Stroke[];
  currentPage: number;
  pageCount: number;

  // Collaboration
  isCollaborative: boolean;

  // Metadata
  title?: string;
  tags: string[];
  thumbnailUrl?: string;

  // Status
  status: 'draft' | 'completed' | 'shared';

  // Export
  exportedImageUrl?: string;
  timelapseUrl?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stroke {
  id: string;
  userId: string;
  tool: StrokeTool;
  color: string;
  thickness: number;
  opacity: number;
  points: StrokePoint[];
  shapeData?: ShapeData;
  textData?: TextData;
  timestamp: number;
  createdAt: string;
}

export type StrokeTool =
  | 'pen'
  | 'marker'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'circle'
  | 'rectangle'
  | 'arrow'
  | 'text';

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
  timestamp: number;
}

export interface ShapeData {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  radius?: number;
}

export interface TextData {
  content: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
}

export interface CustomEmoji {
  id: string;
  coupleId: string;
  name: string;
  shortcode: string;
  category: 'love' | 'funny' | 'reaction' | 'inside_joke' | 'custom';
  tags: string[];
  imageUrl: string;
  thumbnailUrl: string;
  isAnimated: boolean;
  animationUrl?: string;
  description?: string;
  createdFrom: 'scratch' | 'template' | 'photo' | 'text' | 'mashup';
  usageCount: number;
  lastUsedAt?: string;
  isFavorite: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sound {
  id: string;
  coupleId: string;
  name: string;
  category: 'romantic' | 'funny' | 'celebration' | 'musical' | 'notification' | 'voice' | 'custom';
  tags: string[];
  audioUrl: string;
  duration: number;
  fileSize: number;
  format: string;
  waveformData: number[];
  description?: string;
  usageCount: number;
  lastUsedAt?: string;
  isFavorite: boolean;
  source: 'default' | 'uploaded' | 'recorded';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
