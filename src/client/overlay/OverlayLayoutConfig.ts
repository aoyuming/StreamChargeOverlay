import { normalizeRoomSlug } from "../../shared/RoomSlug";

export type OverlayWidgetKey = "todayPrograms" | "recentRanking" | "chargeBar";
export type OverlayChargeShape = "beveled" | "trapezoid" | "rectangle";

export type OverlayWidgetLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  fontScale: number;
  shape?: OverlayChargeShape;
};

export type OverlayLayout = Record<OverlayWidgetKey, OverlayWidgetLayout>;

const STORAGE_KEY_PREFIX = "streamChargeOverlay.overlayLayout";
const MIN_WIDGET_SIZE = 24;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const MIN_FONT_SCALE = 0.7;
const MAX_FONT_SCALE = 1.8;

const WIDGET_CSS_NAMES: Record<OverlayWidgetKey, string> = {
  todayPrograms: "today-programs",
  recentRanking: "recent-ranking",
  chargeBar: "charge-bar"
};

export const DEFAULT_OVERLAY_LAYOUT: OverlayLayout = {
  todayPrograms: { x: 1, y: 455, w: 339, h: 267, scale: 1.1, fontScale: 1 },
  recentRanking: { x: 1537, y: 819, w: 316, h: 250, scale: 1.2, fontScale: 1 },
  chargeBar: { x: 762, y: 922, w: 401, h: 24, scale: 1, fontScale: 1, shape: "rectangle" }
};

const LEGACY_DEFAULT_OVERLAY_LAYOUTS: OverlayLayout[] = [
  {
    todayPrograms: { x: 1, y: 455, w: 339, h: 267, scale: 1.1, fontScale: 1 },
    recentRanking: { x: 1533, y: 821, w: 318, h: 212, scale: 1.2, fontScale: 1 },
    chargeBar: { x: 708, y: 888, w: 513, h: 24, scale: 1, fontScale: 1.2, shape: "beveled" }
  },
  {
    todayPrograms: { x: 1, y: 455, w: 339, h: 267, scale: 1.1, fontScale: 1 },
    recentRanking: { x: 1533, y: 821, w: 318, h: 212, scale: 1.2, fontScale: 1 },
    chargeBar: { x: 708, y: 888, w: 513, h: 24, scale: 1, fontScale: 1.2, shape: "rectangle" }
  },
  {
    todayPrograms: { x: 1, y: 455, w: 339, h: 267, scale: 1.1, fontScale: 1 },
    recentRanking: { x: 1500, y: 819, w: 346, h: 213, scale: 1.2, fontScale: 1 },
    chargeBar: { x: 535, y: 95, w: 895, h: 38, scale: 1, fontScale: 1.28, shape: "beveled" }
  },
  {
    todayPrograms: { x: 1, y: 455, w: 339, h: 267, scale: 1.1, fontScale: 1 },
    recentRanking: { x: 1500, y: 819, w: 346, h: 213, scale: 1.2, fontScale: 1 },
    chargeBar: { x: 535, y: 95, w: 895, h: 38, scale: 1, fontScale: 1.28, shape: "trapezoid" }
  },
  {
    todayPrograms: { x: 6, y: 470, w: 356, h: 316, scale: 1, fontScale: 1 },
    recentRanking: { x: 1507, y: 818, w: 407, h: 250, scale: 1, fontScale: 1 },
    chargeBar: { x: 548, y: 104, w: 620, h: 38, scale: 1, fontScale: 1.18, shape: "beveled" }
  },
  {
    todayPrograms: { x: 6, y: 470, w: 356, h: 316, scale: 1, fontScale: 1 },
    recentRanking: { x: 1507, y: 818, w: 407, h: 250, scale: 1, fontScale: 1 },
    chargeBar: { x: 548, y: 104, w: 620, h: 38, scale: 1, fontScale: 1.18, shape: "rectangle" }
  }
];

export const storageKeyForRoom = (roomSlug: string): string => {
  return `${STORAGE_KEY_PREFIX}.${normalizeRoomSlug(roomSlug)}`;
};

export const encodeOverlayLayout = (layout: Partial<Record<OverlayWidgetKey, Partial<OverlayWidgetLayout>>>): string => {
  return toBase64Url(JSON.stringify(normalizeLayout(layout) ?? cloneLayout(DEFAULT_OVERLAY_LAYOUT)));
};

export const decodeOverlayLayout = (encodedLayout: string): OverlayLayout | null => {
  try {
    return normalizeLayout(JSON.parse(fromBase64Url(encodedLayout)));
  } catch {
    return null;
  }
};

export const loadOverlayLayout = (
  location: Pick<Location, "search">,
  storage: Pick<Storage, "getItem">,
  roomSlug: string
): OverlayLayout => {
  const savedLayout = storage.getItem(storageKeyForRoom(roomSlug));
  if (savedLayout) {
    try {
      const parsed = normalizeLayout(JSON.parse(savedLayout));
      if (parsed) {
        if (isLegacyDefaultLayout(parsed)) {
          return cloneLayout(DEFAULT_OVERLAY_LAYOUT);
        }

        return parsed;
      }
    } catch {
      return cloneLayout(DEFAULT_OVERLAY_LAYOUT);
    }
  }

  const urlLayout = new URLSearchParams(location.search).get("layout");
  if (urlLayout) {
    const decoded = decodeOverlayLayout(urlLayout);
    if (decoded) {
      return decoded;
    }
  }

  return cloneLayout(DEFAULT_OVERLAY_LAYOUT);
};

export const saveOverlayLayout = (
  storage: Pick<Storage, "setItem">,
  roomSlug: string,
  layout: OverlayLayout
): void => {
  storage.setItem(storageKeyForRoom(roomSlug), JSON.stringify(normalizeLayout(layout) ?? DEFAULT_OVERLAY_LAYOUT));
};

export const resetOverlayLayout = (storage: Pick<Storage, "removeItem">, roomSlug: string): void => {
  storage.removeItem(storageKeyForRoom(roomSlug));
};

export const applyOverlayLayout = (
  root: { style: Pick<CSSStyleDeclaration, "setProperty"> },
  layout: OverlayLayout
): void => {
  const normalizedLayout = normalizeLayout(layout) ?? DEFAULT_OVERLAY_LAYOUT;

  for (const key of overlayWidgetKeys()) {
    const cssName = WIDGET_CSS_NAMES[key];
    const widget = normalizedLayout[key];
    root.style.setProperty(`--overlay-${cssName}-x`, `${widget.x}px`);
    root.style.setProperty(`--overlay-${cssName}-y`, `${widget.y}px`);
    root.style.setProperty(`--overlay-${cssName}-w`, `${widget.w}px`);
    root.style.setProperty(`--overlay-${cssName}-h`, `${widget.h}px`);
    root.style.setProperty(`--overlay-${cssName}-scale`, String(widget.scale));
    root.style.setProperty(`--overlay-${cssName}-font-scale`, String(widget.fontScale));
  }
};

export const overlayWidgetKeys = (): OverlayWidgetKey[] => ["todayPrograms", "recentRanking", "chargeBar"];

export const cloneLayout = (layout: OverlayLayout): OverlayLayout => ({
  todayPrograms: { ...layout.todayPrograms },
  recentRanking: { ...layout.recentRanking },
  chargeBar: { ...layout.chargeBar }
});

const normalizeLayout = (value: unknown): OverlayLayout | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<Record<OverlayWidgetKey, Partial<OverlayWidgetLayout>>>;

  return {
    todayPrograms: normalizeWidget("todayPrograms", candidate.todayPrograms, DEFAULT_OVERLAY_LAYOUT.todayPrograms),
    recentRanking: normalizeWidget("recentRanking", candidate.recentRanking, DEFAULT_OVERLAY_LAYOUT.recentRanking),
    chargeBar: normalizeWidget("chargeBar", candidate.chargeBar, DEFAULT_OVERLAY_LAYOUT.chargeBar)
  };
};

const normalizeWidget = (
  key: OverlayWidgetKey,
  value: Partial<OverlayWidgetLayout> | undefined,
  fallback: OverlayWidgetLayout
): OverlayWidgetLayout => {
  const rawScale = finiteNumber(value?.scale, fallback.scale);
  const legacyChargeScale =
    key === "chargeBar" && typeof value?.scale === "number" && value.scale !== 1 && value.fontScale === undefined;
  const legacyScale = clamp(rawScale, MIN_SCALE, MAX_SCALE);
  const scale = key === "chargeBar" ? 1 : clamp(rawScale, MIN_SCALE, MAX_SCALE);
  const width = Math.max(MIN_WIDGET_SIZE, finiteNumber(value?.w, fallback.w));
  const height = Math.max(MIN_WIDGET_SIZE, finiteNumber(value?.h, fallback.h));

  const normalized: OverlayWidgetLayout = {
    x: finiteNumber(value?.x, fallback.x),
    y: finiteNumber(value?.y, fallback.y),
    w: Math.round(width * (legacyChargeScale ? legacyScale : 1)),
    h: Math.round(height * (legacyChargeScale ? legacyScale : 1)),
    scale,
    fontScale: clamp(finiteNumber(value?.fontScale, fallback.fontScale), MIN_FONT_SCALE, MAX_FONT_SCALE)
  };

  if (key === "chargeBar") {
    normalized.shape = normalizeChargeShape(value?.shape, fallback.shape ?? "beveled");
  }

  return normalized;
};

const finiteNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : fallback;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeChargeShape = (value: unknown, fallback: OverlayChargeShape): OverlayChargeShape => {
  return value === "beveled" || value === "rectangle" || value === "trapezoid" ? value : fallback;
};

const isLegacyDefaultLayout = (layout: OverlayLayout): boolean => {
  return LEGACY_DEFAULT_OVERLAY_LAYOUTS.some((legacyLayout) => layoutsEqual(layout, legacyLayout));
};

const layoutsEqual = (left: OverlayLayout, right: OverlayLayout): boolean => {
  return overlayWidgetKeys().every((key) => widgetsEqual(left[key], right[key]));
};

const widgetsEqual = (left: OverlayWidgetLayout, right: OverlayWidgetLayout): boolean => {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.w === right.w &&
    left.h === right.h &&
    left.scale === right.scale &&
    left.fontScale === right.fontScale &&
    (left.shape ?? "beveled") === (right.shape ?? "beveled")
  );
};

const toBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string): string => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};
