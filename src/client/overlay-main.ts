import "./styles/display.css";
import "./styles/overlay.css";
import { ApiClient } from "./common/ApiClient";
import { queryRequired } from "./common/dom";
import { RealtimeClient } from "./common/RealtimeClient";
import { RoomContext } from "./common/RoomContext";
import { preferredRoomSlug, rememberRoomSlug, savedRoomSlug } from "./common/RoomSelection";
import { DisplayApp } from "./display/DisplayApp";
import { DisplayStageScaler } from "./display/DisplayStageScaler";
import { OverlayLayoutEditor } from "./overlay/OverlayLayoutEditor";
import { applyOverlayLayout, loadOverlayLayout } from "./overlay/OverlayLayoutConfig";

new DisplayStageScaler(document.documentElement, window, { width: 1920, height: 1080 }).start();

const roomContext = RoomContext.fromPath(window.location.pathname);
const rooms = await new ApiClient(roomContext).getRooms();
const selectedSlug = preferredRoomSlug(rooms, savedRoomSlug(window.localStorage), roomContext.slug);

rememberRoomSlug(window.localStorage, selectedSlug);

const overlayRoomPanel = queryRequired<HTMLElement>("#overlayRoomPanel");
const overlayRoomPanelToggle = queryRequired<HTMLButtonElement>("#overlayRoomPanelToggle");
const overlayRoomPanelCurrent = queryRequired<HTMLElement>("#overlayRoomPanelCurrent");
const overlayRoomList = queryRequired<HTMLElement>("#overlayRoomList");
const overlayCopyLayoutParams = queryRequired<HTMLButtonElement>("#overlayCopyLayoutParams");
const overlayImportLayoutInput = queryRequired<HTMLInputElement>("#overlayImportLayoutInput");
const overlayImportLayoutApply = queryRequired<HTMLButtonElement>("#overlayImportLayoutApply");
const overlayResetLayoutParams = queryRequired<HTMLButtonElement>("#overlayResetLayoutParams");
const overlayChargeShapeBeveled = queryRequired<HTMLButtonElement>("#overlayChargeShapeBeveled");
const overlayChargeShapeTrapezoid = queryRequired<HTMLButtonElement>("#overlayChargeShapeTrapezoid");
const overlayChargeShapeRectangle = queryRequired<HTMLButtonElement>("#overlayChargeShapeRectangle");
const overlayChargeWidthDown = queryRequired<HTMLButtonElement>("#overlayChargeWidthDown");
const overlayChargeWidthUp = queryRequired<HTMLButtonElement>("#overlayChargeWidthUp");
const overlayChargeHeightDown = queryRequired<HTMLButtonElement>("#overlayChargeHeightDown");
const overlayChargeHeightUp = queryRequired<HTMLButtonElement>("#overlayChargeHeightUp");
const overlayChargeSizeLabel = queryRequired<HTMLElement>("#overlayChargeSizeLabel");
const overlayLayoutPanelMessage = queryRequired<HTMLElement>("#overlayLayoutPanelMessage");
const editorMessage = queryRequired<HTMLElement>("#overlayEditorMessage");
const fullEditor = OverlayLayoutEditor.isEditing(window.location);
let activeRoomSlug = selectedSlug;
let controlsTimer = 0;

const layout = loadOverlayLayout(window.location, window.localStorage, selectedSlug);
applyOverlayLayout(document.documentElement, layout);

const editor = new OverlayLayoutEditor({
  document,
  layout,
  location: window.location,
  roomSlug: selectedSlug,
  root: document.documentElement,
  storage: window.localStorage,
  window
});
editor.start({ fullEditor });

const app = new DisplayApp(apiClientForRoom(selectedSlug), realtimeClientForRoom(selectedSlug));
renderOverlayRoomOptions(selectedSlug);
refreshChargeBarControls();
bindOverlayRoomPanel();
bindOverlayChargeTools();
await app.start();

function apiClientForRoom(roomSlug: string): ApiClient {
  return new ApiClient(new RoomContext(roomSlug));
}

function realtimeClientForRoom(roomSlug: string): RealtimeClient {
  return new RealtimeClient(new RoomContext(roomSlug));
}

function bindOverlayRoomPanel(): void {
  overlayRoomPanelToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setRoomPanelOpen(!overlayRoomPanel.classList.contains("is-room-panel-open"));
    showOverlayControls();
  });

  window.addEventListener("pointermove", () => showOverlayControls());
  window.addEventListener("pointerdown", (event) => {
    showOverlayControls();
    if (event.target instanceof Node && !overlayRoomPanel.contains(event.target)) {
      setRoomPanelOpen(false);
    }
  });

  overlayCopyLayoutParams.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void copyOverlayLayoutParams();
  });

  overlayImportLayoutApply.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    importOverlayLayoutParams();
  });

  overlayResetLayoutParams.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetOverlayLayoutParams();
  });

  overlayImportLayoutInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      importOverlayLayoutParams();
    }
  });

}

function bindOverlayChargeTools(): void {
  overlayChargeShapeBeveled.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setChargeBarShape("beveled");
  });

  overlayChargeShapeTrapezoid.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setChargeBarShape("trapezoid");
  });

  overlayChargeShapeRectangle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setChargeBarShape("rectangle");
  });

  overlayChargeWidthDown.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    adjustChargeBarSize(-40, 0);
  });

  overlayChargeWidthUp.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    adjustChargeBarSize(40, 0);
  });

  overlayChargeHeightDown.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    adjustChargeBarSize(0, -4);
  });

  overlayChargeHeightUp.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    adjustChargeBarSize(0, 4);
  });
}

function setChargeBarShape(shape: "beveled" | "trapezoid" | "rectangle"): void {
  editor.setChargeBarShape(shape);
  refreshChargeBarControls();
  showOverlayControls();
}

function renderOverlayRoomOptions(selectedSlug: string): void {
  const buttons = rooms.map((room) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "overlay-room-option";
    button.dataset.overlayRoomSlug = room.slug;
    button.textContent = room.name;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(room.slug === selectedSlug));
    button.classList.toggle("is-active", room.slug === selectedSlug);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void switchOverlayRoom(room.slug);
    });
    return button;
  });

  overlayRoomList.replaceChildren(...buttons);
  const selectedRoom = rooms.find((room) => room.slug === selectedSlug);
  overlayRoomPanelCurrent.textContent = selectedRoom?.name ?? "选择房间";
}

async function switchOverlayRoom(roomSlug: string): Promise<void> {
  if (!rooms.some((room) => room.slug === roomSlug)) {
    return;
  }

  if (roomSlug === activeRoomSlug) {
    setRoomPanelOpen(false);
    return;
  }

  activeRoomSlug = roomSlug;
  rememberRoomSlug(window.localStorage, roomSlug);
  const nextLayout = loadOverlayLayout(window.location, window.localStorage, roomSlug);
  editor.switchRoom(roomSlug, nextLayout);
  renderOverlayRoomOptions(roomSlug);
  refreshChargeBarControls();
  setRoomPanelOpen(false);
  showOverlayControls();

  try {
    await app.switchDataSource(apiClientForRoom(roomSlug), realtimeClientForRoom(roomSlug));
  } catch (error) {
    editorMessage.textContent = error instanceof Error ? error.message : "切换房间失败";
  }
}

async function copyOverlayLayoutParams(): Promise<void> {
  const layoutParam = editor.exportLayoutParam();
  try {
    const clipboard = window.navigator.clipboard;
    if (!clipboard) {
      throw new Error("Clipboard unavailable");
    }
    await clipboard.writeText(layoutParam);
    showLayoutPanelMessage("排列参数已复制");
  } catch {
    overlayImportLayoutInput.value = layoutParam;
    overlayImportLayoutInput.select();
    showLayoutPanelMessage("已放到输入框，可手动复制");
  }
}

function importOverlayLayoutParams(): void {
  const imported = editor.importLayoutParam(overlayImportLayoutInput.value);
  if (!imported) {
    showLayoutPanelMessage("排列参数无效");
    return;
  }

  overlayImportLayoutInput.value = "";
  refreshChargeBarControls();
  showLayoutPanelMessage("已导入并保存到当前房间");
  showOverlayControls();
}

function resetOverlayLayoutParams(): void {
  editor.resetToDefaultLayout();
  overlayImportLayoutInput.value = "";
  refreshChargeBarControls();
  showLayoutPanelMessage("已恢复默认排列");
  showOverlayControls();
}

function adjustChargeBarSize(deltaWidth: number, deltaHeight: number): void {
  const next = editor.adjustChargeBarSize(deltaWidth, deltaHeight);
  refreshChargeBarControls();
  showLayoutPanelMessage(`充能条尺寸 ${next.w} x ${next.h}`);
  showOverlayControls();
}

function refreshChargeBarControls(): void {
  const shape = editor.chargeBarShape();
  const size = editor.chargeBarSize();
  overlayChargeShapeBeveled.classList.toggle("is-active", shape === "beveled");
  overlayChargeShapeTrapezoid.classList.toggle("is-active", shape === "trapezoid");
  overlayChargeShapeRectangle.classList.toggle("is-active", shape === "rectangle");
  overlayChargeSizeLabel.textContent = `${size.w} x ${size.h}`;
}

function setRoomPanelOpen(isOpen: boolean): void {
  overlayRoomPanel.classList.toggle("is-room-panel-open", isOpen);
  overlayRoomPanelToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    document.body.classList.add("is-overlay-controls-active");
  }
}

function showLayoutPanelMessage(message: string): void {
  overlayLayoutPanelMessage.textContent = message;
  editorMessage.textContent = message;
}

function showOverlayControls(): void {
  document.body.classList.add("is-overlay-controls-active");
  window.clearTimeout(controlsTimer);

  if (!fullEditor) {
    controlsTimer = window.setTimeout(() => {
      if (!overlayRoomPanel.classList.contains("is-room-panel-open")) {
        document.body.classList.remove("is-overlay-controls-active");
      }
    }, 4500);
  }
}
