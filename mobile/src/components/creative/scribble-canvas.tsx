import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Image as SvgImage, Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import {
  Pen,
  Highlighter,
  Eraser,
  Circle as CircleIcon,
  Square,
  Minus,
  ArrowRight,
  Undo,
  Redo,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText, Touchable } from '@/components/ui';

export type ScribbleTool =
  | 'pen'
  | 'marker'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'circle'
  | 'rectangle'
  | 'arrow';

/** A point in canvas pixel space. */
interface Point {
  x: number;
  y: number;
}

/** A point normalized to 0..1 of the canvas size — used over the wire so it
 * renders correctly on a partner's differently-sized canvas. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  tool: ScribbleTool;
  color: string;
  thickness: number;
  opacity: number;
  points: Point[];
}

/** Shape emitted/received over the socket for a single stroke. Streamed live:
 * the same `id` is sent repeatedly as the stroke grows, with `done: true` on
 * the final emit. */
export interface RemoteScribbleStroke {
  id: string;
  tool: ScribbleTool;
  color: string;
  /** Normalized line width (fraction of canvas height) so it scales across sizes. */
  width: number;
  opacity: number;
  points: NormalizedPoint[];
  done: boolean;
}

export interface ScribbleCanvasHandle {
  /** PNG data URL of the current canvas. */
  toDataURL: () => Promise<string | null>;
  /** Apply a stroke (live or final) received from the partner. */
  applyRemoteStroke: (stroke: RemoteScribbleStroke) => void;
  /** Clear the canvas (local only — does not emit). */
  clearLocal: () => void;
  /** Paint a snapshot (data URL) as the base layer — used for join sync. */
  loadImage: (url: string) => void;
  /** Whether anything has been drawn (used to skip empty sync responses). */
  hasContent: () => boolean;
  /** The canvas background color currently in use. */
  getBackgroundColor: () => string;
}

interface ScribbleCanvasProps {
  height?: number;
  style?: ViewStyle;
  onLocalStroke?: (stroke: RemoteScribbleStroke) => void;
  onClear?: () => void;
  onCursorMove?: (point: NormalizedPoint) => void;
  partnerCursor?: NormalizedPoint | null;
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF6B6B',
  '#FF9500', '#FFD93D', '#51CF66', '#6BCB77',
  '#339AF0', '#5C7CFA', '#845EF7', '#A084DC',
  '#F06595', '#FF6B9D', '#868E96', '#495057',
];

const TOOL_OPACITY: Record<ScribbleTool, number> = {
  pen: 1,
  marker: 0.8,
  highlighter: 0.3,
  eraser: 1,
  line: 1,
  circle: 1,
  rectangle: 1,
  arrow: 1,
};

const FREEHAND: ScribbleTool[] = ['pen', 'marker', 'highlighter', 'eraser'];

/** Min ms between live stroke broadcasts while drawing. */
const STREAM_INTERVAL = 45;

/** Build an SVG path "d" string that reproduces the web's quadratic smoothing
 * for freehand and the right primitive for shape tools. */
function buildPathD(stroke: Stroke): string {
  const pts = stroke.points;
  if (pts.length === 0) return '';

  if (FREEHAND.includes(stroke.tool)) {
    if (pts.length < 2) {
      // Single tap — a tiny dot drawn as a degenerate path (handled via Circle).
      return '';
    }
    const first = pts[0]!;
    let d = `M ${first.x} ${first.y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const cur = pts[i]!;
      const next = pts[i + 1]!;
      d += ` Q ${cur.x} ${cur.y} ${(cur.x + next.x) / 2} ${(cur.y + next.y) / 2}`;
    }
    const last = pts[pts.length - 1]!;
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  if (pts.length < 2) return '';
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;

  if (stroke.tool === 'line') {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }
  if (stroke.tool === 'arrow') {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = Math.max(stroke.thickness * 3, 12);
    const a1x = end.x - headLen * Math.cos(angle - Math.PI / 6);
    const a1y = end.y - headLen * Math.sin(angle - Math.PI / 6);
    const a2x = end.x - headLen * Math.cos(angle + Math.PI / 6);
    const a2y = end.y - headLen * Math.sin(angle + Math.PI / 6);
    return (
      `M ${start.x} ${start.y} L ${end.x} ${end.y} ` +
      `M ${end.x} ${end.y} L ${a1x} ${a1y} ` +
      `M ${end.x} ${end.y} L ${a2x} ${a2y}`
    );
  }
  if (stroke.tool === 'rectangle') {
    return `M ${start.x} ${start.y} H ${end.x} V ${end.y} H ${start.x} Z`;
  }
  // circle (ellipse)
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(end.x - start.x) / 2;
  const ry = Math.abs(end.y - start.y) / 2;
  if (rx === 0 || ry === 0) return '';
  return (
    `M ${cx - rx} ${cy} ` +
    `a ${rx} ${ry} 0 1 0 ${rx * 2} 0 ` +
    `a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`
  );
}

/** A rendered SVG path/dot for a stroke. */
function StrokePath({ stroke }: { stroke: Stroke }) {
  const isFreehand = FREEHAND.includes(stroke.tool);
  if (isFreehand && stroke.points.length < 2) {
    const p = stroke.points[0];
    if (!p) return null;
    return (
      <Circle
        cx={p.x}
        cy={p.y}
        r={Math.max(stroke.thickness / 2, 0.5)}
        fill={stroke.color}
        opacity={stroke.opacity}
      />
    );
  }
  const d = buildPathD(stroke);
  if (!d) return null;
  return (
    <Path
      d={d}
      stroke={stroke.color}
      strokeWidth={stroke.thickness}
      strokeOpacity={stroke.opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

export const ScribbleCanvas = forwardRef<ScribbleCanvasHandle, ScribbleCanvasProps>(
  function ScribbleCanvas(
    { height = 360, style, onLocalStroke, onClear, onCursorMove, partnerCursor },
    ref,
  ) {
    const { colors, radius } = useTheme();

    const [tool, setTool] = useState<ScribbleTool>('pen');
    const [color, setColor] = useState('#000000');
    const [thickness, setThickness] = useState(4);
    const [backgroundColor] = useState('#FFFFFF');

    const [size, setSize] = useState({ width: 1, height });

    // Committed local strokes (undo history) + redo buffer + active stroke.
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
    const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);

    // Partner work: finished strokes outside local undo, plus live previews.
    const [remoteStrokes, setRemoteStrokes] = useState<Stroke[]>([]);
    const [liveRemote, setLiveRemote] = useState<Record<string, Stroke>>({});

    // Base snapshot (join sync) painted beneath everything.
    const [baseImage, setBaseImage] = useState<string | null>(null);

    const canvasRef = useRef<View>(null);
    const sizeRef = useRef(size);
    sizeRef.current = size;

    const lastStreamRef = useRef(0);
    const activeRef = useRef<Stroke | null>(null);
    activeRef.current = activeStroke;

    const isShapeTool = ['line', 'circle', 'rectangle', 'arrow'].includes(tool);

    const broadcast = (stroke: Stroke, done: boolean) => {
      if (!onLocalStroke) return;
      const w = sizeRef.current.width || 1;
      const h = sizeRef.current.height || 1;
      onLocalStroke({
        id: stroke.id,
        tool: stroke.tool,
        color: stroke.tool === 'eraser' ? backgroundColor : stroke.color,
        width: stroke.thickness / h,
        opacity: stroke.opacity,
        points: stroke.points.map((p) => ({ x: p.x / w, y: p.y / h })),
        done,
      });
    };

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: (e) => {
            const { locationX, locationY } = e.nativeEvent;
            const point = { x: locationX, y: locationY };
            const id = `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            lastStreamRef.current = 0;
            const stroke: Stroke = {
              id,
              tool,
              color: tool === 'eraser' ? backgroundColor : color,
              thickness: tool === 'highlighter' ? thickness * 3 : thickness,
              opacity: TOOL_OPACITY[tool],
              points: [point],
            };
            setActiveStroke(stroke);
          },
          onPanResponderMove: (e) => {
            const { locationX, locationY } = e.nativeEvent;
            const point = { x: locationX, y: locationY };
            const w = sizeRef.current.width || 1;
            const h = sizeRef.current.height || 1;
            onCursorMove?.({ x: point.x / w, y: point.y / h });

            const prev = activeRef.current;
            if (!prev) return;
            const updated: Stroke = isShapeTool
              ? { ...prev, points: [prev.points[0]!, point] }
              : { ...prev, points: [...prev.points, point] };
            activeRef.current = updated;
            setActiveStroke(updated);

            const now = Date.now();
            if (now - lastStreamRef.current >= STREAM_INTERVAL) {
              lastStreamRef.current = now;
              broadcast(updated, false);
            }
          },
          onPanResponderRelease: () => {
            const prev = activeRef.current;
            if (prev && prev.points.length >= 1) {
              setStrokes((s) => [...s, prev]);
              setUndoneStrokes([]);
              broadcast(prev, true);
            }
            activeRef.current = null;
            setActiveStroke(null);
            onCursorMove?.({ x: -1, y: -1 });
          },
          onPanResponderTerminate: () => {
            const prev = activeRef.current;
            if (prev && prev.points.length >= 1) {
              setStrokes((s) => [...s, prev]);
              setUndoneStrokes([]);
              broadcast(prev, true);
            }
            activeRef.current = null;
            setActiveStroke(null);
            onCursorMove?.({ x: -1, y: -1 });
          },
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [tool, color, thickness, isShapeTool],
    );

    useImperativeHandle(
      ref,
      () => ({
        toDataURL: async () => {
          if (!canvasRef.current) return null;
          try {
            const uri = await captureRef(canvasRef, {
              format: 'png',
              quality: 1,
              result: 'data-uri',
            });
            return uri;
          } catch {
            return null;
          }
        },
        applyRemoteStroke: (remote) => {
          const w = sizeRef.current.width || 1;
          const h = sizeRef.current.height || 1;
          const stroke: Stroke = {
            id: remote.id,
            tool: remote.tool,
            color: remote.color,
            thickness: Math.max(remote.width * h, 0.5),
            opacity: remote.opacity,
            points: remote.points.map((p) => ({ x: p.x * w, y: p.y * h })),
          };
          if (remote.done) {
            setLiveRemote((m) => {
              const next = { ...m };
              delete next[remote.id];
              return next;
            });
            setRemoteStrokes((s) => [...s, stroke]);
          } else {
            setLiveRemote((m) => ({ ...m, [remote.id]: stroke }));
          }
        },
        clearLocal: () => {
          setRemoteStrokes([]);
          setLiveRemote({});
          setBaseImage(null);
          setStrokes([]);
          setUndoneStrokes([]);
        },
        loadImage: (url) => setBaseImage(url),
        hasContent: () =>
          strokes.length > 0 ||
          remoteStrokes.length > 0 ||
          Object.keys(liveRemote).length > 0 ||
          baseImage !== null,
        getBackgroundColor: () => backgroundColor,
      }),
      [strokes, remoteStrokes, liveRemote, baseImage, backgroundColor],
    );

    const undo = () => {
      setStrokes((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1]!;
        setUndoneStrokes((u) => [...u, last]);
        return prev.slice(0, -1);
      });
    };

    const redo = () => {
      setUndoneStrokes((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1]!;
        setStrokes((s) => [...s, last]);
        return prev.slice(0, -1);
      });
    };

    const clear = () => {
      setRemoteStrokes([]);
      setLiveRemote({});
      setBaseImage(null);
      setStrokes([]);
      setUndoneStrokes([]);
      onClear?.();
    };

    const onCanvasLayout = (e: LayoutChangeEvent) => {
      const { width, height: h } = e.nativeEvent.layout;
      setSize({ width, height: h });
    };

    const tools: { id: ScribbleTool; icon: typeof Pen; label: string }[] = [
      { id: 'pen', icon: Pen, label: 'Pen' },
      { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
      { id: 'eraser', icon: Eraser, label: 'Eraser' },
      { id: 'line', icon: Minus, label: 'Line' },
      { id: 'circle', icon: CircleIcon, label: 'Circle' },
      { id: 'rectangle', icon: Square, label: 'Rectangle' },
      { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    ];

    const liveRemoteList = Object.values(liveRemote);

    return (
      <View style={[{ gap: 12 }, style]}>
        {/* Toolbar */}
        <View
          style={[
            styles.toolbar,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
            {tools.map(({ id, icon: Icon, label }) => {
              const selected = tool === id;
              return (
                <Touchable
                  key={id}
                  accessibilityLabel={label}
                  onPress={() => setTool(id)}
                  style={StyleSheet.flatten([
                    styles.toolBtn,
                    { backgroundColor: selected ? colors.primary : 'transparent' },
                  ])}
                >
                  <Icon color={selected ? colors.textOnPrimary : colors.textMuted} size={18} />
                </Touchable>
              );
            })}
          </ScrollView>
        </View>

        {/* Colors */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
          {COLORS.map((c) => {
            const selected = color === c;
            return (
              <Touchable
                key={c}
                onPress={() => setColor(c)}
                accessibilityLabel={`Color ${c}`}
                style={StyleSheet.flatten([
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: selected ? colors.primary : colors.border,
                    borderWidth: selected ? 3 : 1,
                    transform: [{ scale: selected ? 1.12 : 1 }],
                  },
                ])}
              />
            );
          })}
        </ScrollView>

        {/* Size stepper */}
        <View style={styles.sizeRow}>
          <AppText variant="caption" muted>Size</AppText>
          <Touchable
            onPress={() => setThickness((t) => Math.max(1, t - 1))}
            style={StyleSheet.flatten([styles.stepBtn, { borderColor: colors.border }])}
          >
            <AppText weight="700">−</AppText>
          </Touchable>
          <AppText variant="label" style={{ width: 24, textAlign: 'center' }}>{thickness}</AppText>
          <Touchable
            onPress={() => setThickness((t) => Math.min(30, t + 1))}
            style={StyleSheet.flatten([styles.stepBtn, { borderColor: colors.border }])}
          >
            <AppText weight="700">+</AppText>
          </Touchable>

          <View style={{ flex: 1 }} />

          <Touchable
            onPress={undo}
            disabled={strokes.length === 0}
            style={StyleSheet.flatten([styles.iconBtn, { opacity: strokes.length === 0 ? 0.3 : 1 }])}
            accessibilityLabel="Undo"
          >
            <Undo color={colors.textMuted} size={18} />
          </Touchable>
          <Touchable
            onPress={redo}
            disabled={undoneStrokes.length === 0}
            style={StyleSheet.flatten([styles.iconBtn, { opacity: undoneStrokes.length === 0 ? 0.3 : 1 }])}
            accessibilityLabel="Redo"
          >
            <Redo color={colors.textMuted} size={18} />
          </Touchable>
          <Touchable onPress={clear} style={styles.iconBtn} accessibilityLabel="Clear all">
            <Trash2 color={colors.error} size={18} />
          </Touchable>
        </View>

        {/* Canvas */}
        <View
          ref={canvasRef}
          collapsable={false}
          onLayout={onCanvasLayout}
          style={[
            styles.canvas,
            { height, backgroundColor, borderColor: colors.border, borderRadius: radius.card },
          ]}
          {...panResponder.panHandlers}
        >
          <Svg width="100%" height="100%">
            {baseImage ? (
              <SvgImage
                href={{ uri: baseImage }}
                x={0}
                y={0}
                width={size.width}
                height={size.height}
                preserveAspectRatio="xMidYMid slice"
              />
            ) : null}
            {remoteStrokes.map((s) => (
              <StrokePath key={s.id} stroke={s} />
            ))}
            {liveRemoteList.map((s) => (
              <StrokePath key={`live-${s.id}`} stroke={s} />
            ))}
            {strokes.map((s) => (
              <StrokePath key={s.id} stroke={s} />
            ))}
            {activeStroke ? <StrokePath stroke={activeStroke} /> : null}
          </Svg>

          {/* Partner cursor */}
          {partnerCursor && partnerCursor.x >= 0 && partnerCursor.y >= 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: partnerCursor.x * size.width - 6,
                top: partnerCursor.y * size.height - 6,
              }}
            >
              <View style={[styles.cursorDot, { backgroundColor: colors.accent }]} />
            </View>
          ) : null}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  toolbar: {
    borderWidth: 1,
    padding: 6,
  },
  toolBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  colorRow: {
    gap: 10,
    paddingVertical: 2,
    alignItems: 'center',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  cursorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
