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
import Svg, { Circle, Image as SvgImage, Path, Rect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import {
  Paintbrush,
  PenLine,
  Highlighter,
  Eraser,
  PaintBucket,
  Undo,
  Redo,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText, Touchable } from '@/components/ui';

export type PaintTool = 'brush' | 'pen' | 'marker' | 'eraser' | 'fill';

interface Point {
  x: number;
  y: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

interface PaintStroke {
  id: string;
  tool: PaintTool;
  color: string;
  thickness: number;
  opacity: number;
  points: Point[];
}

/** Shape emitted/received over the socket for a painting stroke. */
export interface RemotePaintStroke {
  points: NormalizedPoint[];
  color: string;
  width: number;
  tool: PaintTool;
  opacity?: number;
}

export interface PaintCanvasHandle {
  toDataURL: () => Promise<string | null>;
  /** Small thumbnail data URL for galleries (same capture on RN). */
  toThumbnailDataURL: (maxWidth?: number) => Promise<string | null>;
  applyRemoteStroke: (stroke: RemotePaintStroke) => void;
  clearLocal: () => void;
  /** Paint an existing image (e.g. a saved painting) onto the canvas. */
  loadImage: (url: string) => void;
  getBackgroundColor: () => string;
}

interface PaintCanvasProps {
  height?: number;
  style?: ViewStyle;
  onLocalStroke?: (stroke: RemotePaintStroke) => void;
  onClear?: () => void;
  onCursorMove?: (point: NormalizedPoint) => void;
  partnerCursor?: NormalizedPoint | null;
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF4444',
  '#FF6B6B', '#FF9500', '#FFD93D', '#FFEC99',
  '#51CF66', '#6BCB77', '#339AF0', '#5C7CFA',
  '#845EF7', '#A084DC', '#F06595', '#FF6B9D',
  '#495057', '#868E96', '#ADB5BD', '#DEE2E6',
  '#8B4513', '#D2691E', '#F4A460', '#FFDAB9',
];

const TOOL_SETTINGS: Record<
  PaintTool,
  { baseThickness: number; opacity: number }
> = {
  brush: { baseThickness: 8, opacity: 1 },
  pen: { baseThickness: 2, opacity: 1 },
  marker: { baseThickness: 18, opacity: 0.4 },
  eraser: { baseThickness: 20, opacity: 1 },
  fill: { baseThickness: 1, opacity: 1 },
};

function buildPathD(points: Point[]): string {
  if (points.length < 2) return '';
  const first = points[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i]!;
    const next = points[i + 1]!;
    d += ` Q ${cur.x} ${cur.y} ${(cur.x + next.x) / 2} ${(cur.y + next.y) / 2}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function StrokeNode({
  stroke,
  fallbackBg,
}: {
  stroke: PaintStroke;
  fallbackBg: string;
}) {
  // Eraser paints in the background color (no destination-out in SVG).
  const strokeColor = stroke.tool === 'eraser' ? fallbackBg : stroke.color;
  if (stroke.points.length < 2) {
    const p = stroke.points[0];
    if (!p) return null;
    return (
      <Circle
        cx={p.x}
        cy={p.y}
        r={Math.max(stroke.thickness / 2, 0.5)}
        fill={strokeColor}
        opacity={stroke.opacity}
      />
    );
  }
  const d = buildPathD(stroke.points);
  if (!d) return null;
  return (
    <Path
      d={d}
      stroke={strokeColor}
      strokeWidth={stroke.thickness}
      strokeOpacity={stroke.opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

export const PaintCanvas = forwardRef<PaintCanvasHandle, PaintCanvasProps>(
  function PaintCanvas(
    { height = 360, style, onLocalStroke, onClear, onCursorMove, partnerCursor },
    ref,
  ) {
    const { colors, radius } = useTheme();

    const [tool, setTool] = useState<PaintTool>('brush');
    const [color, setColor] = useState('#339AF0');
    const [sizeMultiplier, setSizeMultiplier] = useState(1);
    const [opacity, setOpacity] = useState(1);
    const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

    const [size, setSize] = useState({ width: 1, height });

    const [strokes, setStrokes] = useState<PaintStroke[]>([]);
    const [undoneStrokes, setUndoneStrokes] = useState<PaintStroke[]>([]);
    const [activeStroke, setActiveStroke] = useState<PaintStroke | null>(null);
    const [remoteStrokes, setRemoteStrokes] = useState<PaintStroke[]>([]);
    const [baseImage, setBaseImage] = useState<string | null>(null);

    const canvasRef = useRef<View>(null);
    const sizeRef = useRef(size);
    sizeRef.current = size;
    const activeRef = useRef<PaintStroke | null>(null);
    activeRef.current = activeStroke;

    // current tool settings mirrored to refs for the pan responder closure
    const toolRef = useRef(tool);
    toolRef.current = tool;
    const colorRef = useRef(color);
    colorRef.current = color;
    const sizeMultRef = useRef(sizeMultiplier);
    sizeMultRef.current = sizeMultiplier;
    const opacityRef = useRef(opacity);
    opacityRef.current = opacity;
    const bgRef = useRef(backgroundColor);
    bgRef.current = backgroundColor;

    const emitStroke = (stroke: PaintStroke) => {
      if (!onLocalStroke) return;
      const w = sizeRef.current.width || 1;
      const h = sizeRef.current.height || 1;
      onLocalStroke({
        points: stroke.points.map((p) => ({ x: p.x / w, y: p.y / h })),
        color: stroke.tool === 'eraser' ? bgRef.current : stroke.color,
        width: stroke.thickness,
        tool: stroke.tool,
        opacity: stroke.opacity,
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
            const t = toolRef.current;

            if (t === 'fill') {
              // SVG has no per-region flood fill — fill the whole background.
              setBackgroundColor(colorRef.current);
              const w = sizeRef.current.width || 1;
              const h = sizeRef.current.height || 1;
              onLocalStroke?.({
                points: [{ x: point.x / w, y: point.y / h }],
                color: colorRef.current,
                width: 1,
                tool: 'fill',
                opacity: 1,
              });
              setUndoneStrokes([]);
              return;
            }

            const settings = TOOL_SETTINGS[t];
            const stroke: PaintStroke = {
              id: `paint-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              tool: t,
              color: t === 'eraser' ? bgRef.current : colorRef.current,
              thickness: settings.baseThickness * sizeMultRef.current,
              opacity: t === 'eraser' ? 1 : opacityRef.current * settings.opacity,
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
            const updated: PaintStroke = { ...prev, points: [...prev.points, point] };
            activeRef.current = updated;
            setActiveStroke(updated);
          },
          onPanResponderRelease: () => {
            const prev = activeRef.current;
            if (prev && prev.points.length >= 1) {
              setStrokes((s) => [...s, prev]);
              setUndoneStrokes([]);
              emitStroke(prev);
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
              emitStroke(prev);
            }
            activeRef.current = null;
            setActiveStroke(null);
            onCursorMove?.({ x: -1, y: -1 });
          },
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        toDataURL: async () => {
          if (!canvasRef.current) return null;
          try {
            return await captureRef(canvasRef, { format: 'png', quality: 1, result: 'data-uri' });
          } catch {
            return null;
          }
        },
        toThumbnailDataURL: async (maxWidth = 320) => {
          if (!canvasRef.current) return null;
          const w = sizeRef.current.width || maxWidth;
          try {
            return await captureRef(canvasRef, {
              format: 'png',
              quality: 0.7,
              result: 'data-uri',
              width: maxWidth,
              height: Math.round((sizeRef.current.height || height) * (maxWidth / w)),
            });
          } catch {
            return null;
          }
        },
        applyRemoteStroke: (remote) => {
          if (remote.tool === 'fill') {
            setBackgroundColor(remote.color);
            return;
          }
          const w = sizeRef.current.width || 1;
          const h = sizeRef.current.height || 1;
          const stroke: PaintStroke = {
            id: `remote-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            tool: remote.tool,
            color: remote.color,
            thickness: remote.width,
            opacity: remote.opacity ?? TOOL_SETTINGS[remote.tool]?.opacity ?? 1,
            points: remote.points.map((p) => ({ x: p.x * w, y: p.y * h })),
          };
          setRemoteStrokes((s) => [...s, stroke]);
        },
        clearLocal: () => {
          setRemoteStrokes([]);
          setBaseImage(null);
          setStrokes([]);
          setUndoneStrokes([]);
        },
        loadImage: (url) => {
          setRemoteStrokes([]);
          setStrokes([]);
          setUndoneStrokes([]);
          setBaseImage(url);
        },
        getBackgroundColor: () => bgRef.current,
      }),
      [height],
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
      setBaseImage(null);
      setStrokes([]);
      setUndoneStrokes([]);
      onClear?.();
    };

    const onCanvasLayout = (e: LayoutChangeEvent) => {
      const { width, height: h } = e.nativeEvent.layout;
      setSize({ width, height: h });
    };

    const toolButtons: { id: PaintTool; icon: typeof Paintbrush; label: string }[] = [
      { id: 'brush', icon: Paintbrush, label: 'Brush' },
      { id: 'pen', icon: PenLine, label: 'Pen (fine)' },
      { id: 'marker', icon: Highlighter, label: 'Marker (wide)' },
      { id: 'eraser', icon: Eraser, label: 'Eraser' },
      { id: 'fill', icon: PaintBucket, label: 'Fill' },
    ];

    return (
      <View style={[{ gap: 12 }, style]}>
        {/* Tools */}
        <View
          style={[
            styles.toolbar,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
            {toolButtons.map(({ id, icon: Icon, label }) => {
              const selected = tool === id;
              return (
                <Touchable
                  key={id}
                  accessibilityLabel={label}
                  onPress={() => setTool(id)}
                  style={StyleSheet.flatten([styles.toolBtn, { backgroundColor: selected ? colors.primary : 'transparent' }])}
                >
                  <Icon color={selected ? colors.textOnPrimary : colors.textMuted} size={20} />
                </Touchable>
              );
            })}
            <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 4 }} />
            <Touchable
              onPress={undo}
              disabled={strokes.length === 0}
              style={StyleSheet.flatten([styles.toolBtn, { opacity: strokes.length === 0 ? 0.3 : 1 }])}
              accessibilityLabel="Undo"
            >
              <Undo color={colors.textMuted} size={20} />
            </Touchable>
            <Touchable
              onPress={redo}
              disabled={undoneStrokes.length === 0}
              style={StyleSheet.flatten([styles.toolBtn, { opacity: undoneStrokes.length === 0 ? 0.3 : 1 }])}
              accessibilityLabel="Redo"
            >
              <Redo color={colors.textMuted} size={20} />
            </Touchable>
            <Touchable onPress={clear} style={styles.toolBtn} accessibilityLabel="Clear all">
              <Trash2 color={colors.error} size={20} />
            </Touchable>
          </ScrollView>
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
            {/* Background captured into the snapshot */}
            <Rect x={0} y={0} width={size.width} height={size.height} fill={backgroundColor} />
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
              <StrokeNode key={s.id} stroke={s} fallbackBg={backgroundColor} />
            ))}
            {strokes.map((s) => (
              <StrokeNode key={s.id} stroke={s} fallbackBg={backgroundColor} />
            ))}
            {activeStroke ? <StrokeNode stroke={activeStroke} fallbackBg={backgroundColor} /> : null}
          </Svg>

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

        {/* Size + Opacity */}
        <View style={{ gap: 10 }}>
          <View style={styles.sizeRow}>
            <AppText variant="caption" muted style={{ width: 52 }}>Size</AppText>
            <Touchable
              onPress={() => setSizeMultiplier((s) => Math.max(0.25, +(s - 0.25).toFixed(2)))}
              style={StyleSheet.flatten([styles.stepBtn, { borderColor: colors.border }])}
            >
              <AppText weight="700">−</AppText>
            </Touchable>
            <AppText variant="label" style={{ width: 44, textAlign: 'center' }}>
              {sizeMultiplier.toFixed(2)}x
            </AppText>
            <Touchable
              onPress={() => setSizeMultiplier((s) => Math.min(6, +(s + 0.25).toFixed(2)))}
              style={StyleSheet.flatten([styles.stepBtn, { borderColor: colors.border }])}
            >
              <AppText weight="700">+</AppText>
            </Touchable>
          </View>

          <View style={styles.sizeRow}>
            <AppText variant="caption" muted style={{ width: 52 }}>Opacity</AppText>
            <Touchable
              onPress={() => setOpacity((o) => Math.max(0.1, +(o - 0.1).toFixed(2)))}
              style={StyleSheet.flatten([styles.stepBtn, { borderColor: colors.border }])}
            >
              <AppText weight="700">−</AppText>
            </Touchable>
            <AppText variant="label" style={{ width: 44, textAlign: 'center' }}>
              {Math.round(opacity * 100)}%
            </AppText>
            <Touchable
              onPress={() => setOpacity((o) => Math.min(1, +(o + 0.1).toFixed(2)))}
              style={StyleSheet.flatten([styles.stepBtn, { borderColor: colors.border }])}
            >
              <AppText weight="700">+</AppText>
            </Touchable>

            <View style={{ flex: 1 }} />

            <AppText variant="caption" muted>BG</AppText>
            {['#FFFFFF', '#000000', '#FFF9DB', '#1A1B2E'].map((bg) => (
              <Touchable
                key={bg}
                onPress={() => setBackgroundColor(bg)}
                accessibilityLabel={`Background ${bg}`}
                style={StyleSheet.flatten([
                  styles.bgSwatch,
                  {
                    backgroundColor: bg,
                    borderColor: backgroundColor === bg ? colors.primary : colors.border,
                    borderWidth: backgroundColor === bg ? 2 : 1,
                  },
                ])}
              />
            ))}
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  toolbar: { borderWidth: 1, padding: 6 },
  toolBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  colorRow: { gap: 10, paddingVertical: 2, alignItems: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  bgSwatch: { width: 26, height: 26, borderRadius: 6 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: { borderWidth: 1, overflow: 'hidden' },
  cursorDot: { width: 12, height: 12, borderRadius: 6 },
});
