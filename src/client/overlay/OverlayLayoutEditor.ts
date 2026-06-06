import {
  DEFAULT_OVERLAY_LAYOUT,
  applyOverlayLayout,
  cloneLayout,
  decodeOverlayLayout,
  encodeOverlayLayout,
  overlayWidgetKeys,
  resetOverlayLayout,
  saveOverlayLayout,
  type OverlayLayout,
  type OverlayChargeShape,
  type OverlayWidgetKey,
  type OverlayWidgetLayout
} from "./OverlayLayoutConfig";
import { fixedPagePath } from "../common/RoomSelection";

type OverlayLayoutEditorOptions = {
  document: Document;
  layout: OverlayLayout;
  location: Location;
  roomSlug: string;
  root: HTMLElement;
  storage: Storage;
  window: Window;
};

type OverlayLayoutEditorStartOptions = {
  fullEditor: boolean;
};

type DragState = {
  key: OverlayWidgetKey;
  mode: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startLayout: OverlayWidgetLayout;
};

const STAGE_WIDTH = 1920;
const SCALE_STEP = 0.1;

const OVERLAY_CHARGE_SHAPES: Record<
  OverlayChargeShape,
  {
    bottomShadowPoints: string;
    points: string;
  }
> = {
  beveled: {
    bottomShadowPoints: "22 37 598 37",
    points: "22 0 598 0 620 19 598 38 22 38 0 19"
  },
  trapezoid: {
    bottomShadowPoints: "24 37 596 37",
    points: "0 0 620 0 596 38 24 38"
  },
  rectangle: {
    bottomShadowPoints: "0 37 620 37",
    points: "0 0 620 0 620 38 0 38"
  }
};

const DEFAULT_CHARGE_SHAPE: OverlayChargeShape = "rectangle";

export class OverlayLayoutEditor {
  private layout: OverlayLayout;
  private roomSlug: string;
  private dragState: DragState | null = null;
  private activeWidgetKey: OverlayWidgetKey | null = null;
  private deactivateTimer = 0;
  private fullEditor = false;
  private readonly widgets = new Map<OverlayWidgetKey, HTMLElement>();

  public constructor(private readonly options: OverlayLayoutEditorOptions) {
    this.layout = cloneLayout(options.layout);
    this.roomSlug = options.roomSlug;
  }

  public static isEditing(location: Pick<Location, "search">): boolean {
    return new URLSearchParams(location.search).get("edit") === "1";
  }

  public start({ fullEditor }: OverlayLayoutEditorStartOptions): void {
    this.fullEditor = fullEditor;
    this.options.document.body.classList.add(fullEditor ? "is-overlay-editing" : "is-overlay-live-editing");
    this.collectWidgets();
    this.bindWidgetInteractions();
    if (fullEditor) {
      this.bindToolbar();
    }
    this.applyLayout();
    this.showMessage(fullEditor ? "编辑模式：拖动区域移动，拖右下角改大小，+/- 改缩放。" : "");
  }

  public switchRoom(roomSlug: string, layout: OverlayLayout): void {
    this.autoSaveLayout();
    this.roomSlug = roomSlug;
    this.layout = cloneLayout(layout);
    this.applyLayout();
    this.showMessage("");
  }

  public exportLayoutParam(): string {
    return encodeOverlayLayout(this.layout);
  }

  public chargeBarShape(): OverlayChargeShape {
    return this.layout.chargeBar.shape ?? DEFAULT_CHARGE_SHAPE;
  }

  public chargeBarSize(): Pick<OverlayWidgetLayout, "h" | "w"> {
    return { h: this.layout.chargeBar.h, w: this.layout.chargeBar.w };
  }

  public setChargeBarShape(shape: OverlayChargeShape): OverlayChargeShape {
    const current = this.layout.chargeBar;
    this.layout.chargeBar = { ...current, shape };
    this.applyLayout();
    this.autoSaveLayout();
    return shape;
  }

  public adjustChargeBarSize(deltaWidth: number, deltaHeight: number): OverlayWidgetLayout {
    const current = this.layout.chargeBar;
    this.layout.chargeBar = {
      ...current,
      w: Math.max(48, Math.round(current.w + deltaWidth)),
      h: Math.max(24, Math.round(current.h + deltaHeight))
    };
    this.applyLayout();
    this.autoSaveLayout();
    return { ...this.layout.chargeBar };
  }

  public importLayoutParam(value: string): boolean {
    const layoutParam = this.extractLayoutParam(value);
    if (!layoutParam) {
      return false;
    }

    const importedLayout = decodeOverlayLayout(layoutParam);
    if (!importedLayout) {
      return false;
    }

    this.layout = cloneLayout(importedLayout);
    this.applyLayout();
    saveOverlayLayout(this.options.storage, this.roomSlug, this.layout);
    return true;
  }

  public resetToDefaultLayout(): void {
    this.layout = cloneLayout(DEFAULT_OVERLAY_LAYOUT);
    resetOverlayLayout(this.options.storage, this.roomSlug);
    this.applyLayout();
  }

  private collectWidgets(): void {
    for (const key of overlayWidgetKeys()) {
      const widget = this.options.document.querySelector<HTMLElement>(`[data-overlay-widget="${key}"]`);
      if (widget) {
        this.widgets.set(key, widget);
      }
    }
  }

  private bindWidgetInteractions(): void {
    for (const [key, widget] of this.widgets) {
      widget.addEventListener("pointerenter", () => this.activateWidget(key));
      widget.addEventListener("pointerleave", () => this.scheduleDeactivateWidget(key));
      widget.addEventListener("click", () => this.activateWidget(key));
      widget.addEventListener("pointerdown", (event) => this.handlePointerDown(event, key));
      widget.querySelector<HTMLElement>("[data-overlay-scale-down]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.adjustScale(key, -SCALE_STEP);
      });
      widget.querySelector<HTMLElement>("[data-overlay-scale-up]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.adjustScale(key, SCALE_STEP);
      });
    }

    this.options.window.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.options.window.addEventListener("pointerup", (event) => this.handlePointerUp(event));
  }

  private bindToolbar(): void {
    this.options.document.querySelector("#overlaySaveLayout")?.addEventListener("click", () => {
      saveOverlayLayout(this.options.storage, this.roomSlug, this.layout);
      this.showMessage("布局已保存到本机。");
    });

    this.options.document.querySelector("#overlayCopyLayout")?.addEventListener("click", () => {
      void this.copyLayoutUrl();
    });

    this.options.document.querySelector("#overlayResetLayout")?.addEventListener("click", () => {
      this.resetToDefaultLayout();
      this.showMessage("已恢复默认位置。");
    });
  }

  private handlePointerDown(event: PointerEvent, key: OverlayWidgetKey): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest(".overlay-editor-toolbar") || target?.closest(".overlay-widget-editor-controls")) {
      return;
    }

    const widget = this.widgets.get(key);
    if (!widget) {
      return;
    }

    event.preventDefault();
    this.activateWidget(key);
    widget.setPointerCapture(event.pointerId);
    this.dragState = {
      key,
      mode: target?.hasAttribute("data-overlay-resize-handle") ? "resize" : "move",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLayout: { ...this.layout[key] }
    };
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    const scale = this.currentStageScale();
    const deltaX = (event.clientX - this.dragState.startClientX) / scale;
    const deltaY = (event.clientY - this.dragState.startClientY) / scale;
    const next = { ...this.dragState.startLayout };

    if (this.dragState.mode === "resize") {
      next.w = Math.max(48, Math.round(this.dragState.startLayout.w + deltaX));
      next.h =
        this.dragState.key === "chargeBar" ? this.dragState.startLayout.h : Math.max(32, Math.round(this.dragState.startLayout.h + deltaY));
    } else {
      next.x = Math.round(this.dragState.startLayout.x + deltaX);
      next.y = Math.round(this.dragState.startLayout.y + deltaY);
    }

    this.layout[this.dragState.key] = next;
    this.applyLayout();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    this.widgets.get(this.dragState.key)?.releasePointerCapture(event.pointerId);
    this.autoSaveLayout();
    this.dragState = null;
  }

  private adjustScale(key: OverlayWidgetKey, delta: number): void {
    if (key === "chargeBar") {
      this.adjustChargeFontScale(delta);
      return;
    }

    const current = this.layout[key];
    this.layout[key] = {
      ...current,
      scale: Math.max(0.4, Math.min(2.5, Math.round((current.scale + delta) * 100) / 100))
    };
    this.applyLayout();
    this.autoSaveLayout();
  }

  private adjustChargeFontScale(delta: number): void {
    const current = this.layout.chargeBar;
    this.layout.chargeBar = {
      ...current,
      fontScale: Math.max(0.7, Math.min(1.8, Math.round((current.fontScale + delta) * 100) / 100))
    };
    this.applyLayout();
    this.autoSaveLayout();
  }

  private applyLayout(): void {
    applyOverlayLayout(this.options.root, this.layout);
    this.applyChargeBarShape();
    this.refreshScaleLabels();
  }

  private applyChargeBarShape(): void {
    const shape = this.chargeBarShape();
    const geometry = OVERLAY_CHARGE_SHAPES[shape];
    const clipShape = this.options.document.querySelector<SVGPolygonElement>("#overlayChargeShapeClip polygon");
    const shell = this.options.document.querySelector<SVGPolygonElement>(".overlay-charge-shell");
    const frame = this.options.document.querySelector<SVGPolygonElement>(".overlay-charge-frame");
    const bottomShadow = this.options.document.querySelector<SVGPolylineElement>(".overlay-charge-bottom-shadow");
    const progressTrack = this.options.document.querySelector<HTMLElement>("#progressTrack");
    const progressEffects = this.options.document.querySelector<HTMLCanvasElement>("#progressEffectsCanvas");

    clipShape?.setAttribute("points", geometry.points);
    shell?.setAttribute("points", geometry.points);
    frame?.setAttribute("points", geometry.points);
    bottomShadow?.setAttribute("points", geometry.bottomShadowPoints);
    progressTrack?.dataset && (progressTrack.dataset.chargeShape = shape);
    progressEffects?.dataset && (progressEffects.dataset.progressEffectShape = shape);
  }

  private refreshScaleLabels(): void {
    for (const [key, widget] of this.widgets) {
      const label = widget.querySelector<HTMLElement>("[data-overlay-scale-value]");
      if (label) {
        const value = key === "chargeBar" ? this.layout[key].fontScale : this.layout[key].scale;
        label.textContent = `${Math.round(value * 100)}%`;
      }
    }
  }

  private activateWidget(key: OverlayWidgetKey): void {
    if (this.fullEditor) {
      return;
    }

    this.options.window.clearTimeout(this.deactivateTimer);
    this.activeWidgetKey = key;
    for (const [widgetKey, widget] of this.widgets) {
      widget.classList.toggle("is-widget-editing", widgetKey === key);
    }
  }

  private scheduleDeactivateWidget(key: OverlayWidgetKey): void {
    if (this.fullEditor) {
      return;
    }

    this.options.window.clearTimeout(this.deactivateTimer);
    this.deactivateTimer = this.options.window.setTimeout(() => {
      if (this.dragState || this.activeWidgetKey !== key) {
        return;
      }

      this.widgets.get(key)?.classList.remove("is-widget-editing");
      this.activeWidgetKey = null;
    }, 900);
  }

  private autoSaveLayout(): void {
    saveOverlayLayout(this.options.storage, this.roomSlug, this.layout);
  }

  private currentStageScale(): number {
    const shell = this.options.document.querySelector<HTMLElement>(".stream-overlay-shell");
    const width = shell?.getBoundingClientRect().width ?? STAGE_WIDTH;
    return width > 0 ? width / STAGE_WIDTH : 1;
  }

  private async copyLayoutUrl(): Promise<void> {
    const url = new URL(this.options.location.href);
    url.pathname = fixedPagePath("overlay");
    url.searchParams.delete("edit");
    url.searchParams.set("layout", this.exportLayoutParam());

    try {
      const clipboard = this.navigatorClipboard();
      if (!clipboard) {
        throw new Error("Clipboard is unavailable");
      }

      await clipboard.writeText(url.toString());
      this.showMessage("OBS 链接已复制。");
    } catch {
      this.showMessage(url.toString());
    }
  }

  private navigatorClipboard(): Clipboard | undefined {
    return this.options.window.navigator.clipboard;
  }

  private extractLayoutParam(value: string): string {
    const text = value.trim();
    if (!text) {
      return "";
    }

    try {
      return new URL(text).searchParams.get("layout") ?? text;
    } catch {
      // Fall through to query-string parsing.
    }

    const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : text;
    try {
      return new URLSearchParams(query).get("layout") ?? text;
    } catch {
      return text;
    }
  }

  private showMessage(text: string): void {
    const message = this.options.document.querySelector<HTMLElement>("#overlayEditorMessage");
    if (message) {
      message.textContent = text;
    }
  }
}
