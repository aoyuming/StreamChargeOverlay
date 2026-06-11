const path = require("node:path");
const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");

const WINDOW_TITLE = "DNF\u8D5E\u52A9\u7CFB\u7EDF";
const DEFAULT_OVERLAY_URL = "http://47.109.149.111:3000/overlay.html";
const SERVER_URL = process.env.STREAMCHARGE_SERVER_URL || DEFAULT_OVERLAY_URL;
const OVERLAY_PATH = "/overlay.html";
const CAPTURE_MODES = new Set(["transparent", "black", "green"]);
const DESKTOP_CHROME_MODES = new Set(["native", "hover"]);
const DESKTOP_CHROME_CSS = `
.desktop-capture-chrome {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  opacity: 0;
  pointer-events: none;
  color: #f7fbff;
  font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
  transition: opacity 120ms ease;
}

html[data-streamcharge-desktop-focused="1"] .desktop-capture-chrome {
  opacity: 1;
}

.desktop-capture-chrome-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 34px;
  display: flex;
  align-items: center;
  padding-left: 12px;
  background: rgba(18, 24, 34, 0.86);
  border-bottom: 1px solid rgba(255, 255, 255, 0.35);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.65), 0 8px 18px rgba(0, 0, 0, 0.24);
  -webkit-app-region: drag;
  pointer-events: auto;
  user-select: none;
}

.desktop-capture-chrome-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
}

.desktop-capture-chrome-controls {
  height: 100%;
  margin-left: auto;
  display: flex;
  align-items: stretch;
  -webkit-app-region: no-drag;
  pointer-events: auto;
}

.desktop-capture-chrome-button {
  width: 46px;
  height: 34px;
  border: 0;
  margin: 0;
  padding: 0;
  color: #f7fbff;
  background: transparent;
  font: 16px/1 "Segoe UI", sans-serif;
  text-align: center;
  cursor: default;
}

.desktop-capture-chrome-button:hover {
  background: rgba(255, 255, 255, 0.18);
}

.desktop-capture-chrome-button.is-close:hover {
  background: #c42b1c;
}

.desktop-capture-chrome-border {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(245, 250, 255, 0.92);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.72),
    inset 0 0 24px rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.65),
    0 0 24px rgba(0, 0, 0, 0.45);
}
`;

let mainWindow = null;
let captureBg = normalizeCaptureMode(process.env.STREAMCHARGE_CAPTURE_BG || "transparent");
let desktopChromeMode = normalizeDesktopChromeMode(process.env.STREAMCHARGE_DESKTOP_CHROME_MODE || "hover");

function overlayUrl(mode = captureBg) {
  const url = new URL(SERVER_URL.endsWith(OVERLAY_PATH) ? SERVER_URL : OVERLAY_PATH, SERVER_URL);
  url.searchParams.set("desktop", "1");
  url.searchParams.set("captureBg", normalizeCaptureMode(mode));
  url.searchParams.set("captureChrome", "0");
  return url.toString();
}

function normalizeCaptureMode(mode) {
  return CAPTURE_MODES.has(mode) ? mode : "transparent";
}

function normalizeDesktopChromeMode(mode) {
  return DESKTOP_CHROME_MODES.has(mode) ? mode : "native";
}

function createWindow(snapshot = {}) {
  const bounds = snapshot.bounds || {};
  const win = new BrowserWindow({
    title: WINDOW_TITLE,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width || 1920,
    height: bounds.height || 1080,
    minWidth: 640,
    minHeight: 360,
    transparent: true,
    backgroundColor: "#00000000",
    frame: desktopChromeMode === "native",
    resizable: true,
    maximizable: true,
    skipTaskbar: false,
    alwaysOnTop: snapshot.alwaysOnTop ?? false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow = win;
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(snapshot.alwaysOnTop ?? false, "screen-saver");
  win.webContents.on("did-finish-load", injectDesktopChrome);
  win.on("focus", syncDesktopChromeFocusState);
  win.on("blur", syncDesktopChromeFocusState);
  win.loadURL(overlayUrl());

  if (snapshot.maximized) {
    win.maximize();
  }

  win.on("closed", () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });
}

async function injectDesktopChrome() {
  if (!mainWindow || desktopChromeMode !== "hover") {
    return;
  }

  try {
    await mainWindow.webContents.insertCSS(DESKTOP_CHROME_CSS);
    await mainWindow.webContents.executeJavaScript(desktopChromeScript(), true);
    await syncDesktopChromeFocusState();
  } catch (error) {
    console.error("Failed to inject StreamCharge desktop chrome:", error);
  }
}

async function syncDesktopChromeFocusState() {
  if (!mainWindow || mainWindow.isDestroyed() || desktopChromeMode !== "hover") {
    return;
  }

  const focused = mainWindow.isFocused() ? "1" : "0";
  try {
    await mainWindow.webContents.executeJavaScript(
      `document.documentElement.dataset.streamchargeDesktopFocused = ${JSON.stringify(focused)};`,
      true
    );
  } catch (error) {
    console.error("Failed to sync StreamCharge desktop chrome focus state:", error);
  }
}

function desktopChromeScript() {
  return `
(() => {
  const title = ${JSON.stringify(WINDOW_TITLE)};
  let chrome = document.querySelector(".desktop-capture-chrome");

  if (!chrome) {
    chrome = document.createElement("div");
    chrome.className = "desktop-capture-chrome";
    chrome.innerHTML = [
      '<div class="desktop-capture-chrome-border"></div>',
      '<div class="desktop-capture-chrome-titlebar">',
      '  <div class="desktop-capture-chrome-title"></div>',
      '  <div class="desktop-capture-chrome-controls">',
      '    <button class="desktop-capture-chrome-button" type="button" data-window-action="minimize" aria-label="最小化">-</button>',
      '    <button class="desktop-capture-chrome-button" type="button" data-window-action="maximize" aria-label="最大化">□</button>',
      '    <button class="desktop-capture-chrome-button is-close" type="button" data-window-action="close" aria-label="关闭">×</button>',
      '  </div>',
      '</div>'
    ].join("");

    chrome.querySelector(".desktop-capture-chrome-title").textContent = title;
    chrome.querySelectorAll("[data-window-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.streamChargeDesktop.windowControl(button.dataset.windowAction);
      });
    });

    document.body.appendChild(chrome);
  }
})();
`;
}

function setCaptureMode(mode) {
  captureBg = normalizeCaptureMode(mode);
  if (mainWindow) {
    mainWindow.loadURL(overlayUrl(captureBg));
  }
}

function getWindowSnapshot() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return {};
  }

  return {
    bounds: mainWindow.getBounds(),
    maximized: mainWindow.isMaximized(),
    alwaysOnTop: mainWindow.isAlwaysOnTop()
  };
}

function rebuildWindowForDesktopChromeMode(nextMode) {
  const previousWindow = mainWindow;
  const snapshot = getWindowSnapshot();
  desktopChromeMode = normalizeDesktopChromeMode(nextMode);
  createWindow(snapshot);

  if (previousWindow && !previousWindow.isDestroyed()) {
    previousWindow.destroy();
  }
}

function toggleDesktopChromeMode() {
  rebuildWindowForDesktopChromeMode(desktopChromeMode === "native" ? "hover" : "native");
}

function registerShortcuts() {
  globalShortcut.register("F6", toggleDesktopChromeMode);
  globalShortcut.register("F8", () => setCaptureMode("transparent"));
  globalShortcut.register("F9", () => setCaptureMode("black"));
  globalShortcut.register("F10", () => setCaptureMode("green"));
  globalShortcut.register("F11", () => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop(), "screen-saver");
    }
  });
  globalShortcut.register("F5", () => {
    if (mainWindow) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });
}

ipcMain.on("streamcharge-window-control", (_event, action) => {
  if (!mainWindow) {
    return;
  }

  if (action === "minimize") {
    mainWindow.minimize();
    return;
  }

  if (action === "maximize") {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return;
    }
    mainWindow.maximize();
    return;
  }

  if (action === "close") {
    mainWindow.close();
  }
});

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
