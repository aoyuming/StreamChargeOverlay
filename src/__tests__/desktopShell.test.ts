import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

describe("desktop shell packaging", () => {
  const mainPath = resolve(process.cwd(), "desktop/main.cjs");
  const launcherPath = resolve(process.cwd(), "desktop/SingleExeLauncher.cs");
  const packageScriptPath = resolve(process.cwd(), "scripts/package-desktop.ps1");

  it("adds development and packaging commands for the live companion window", () => {
    expect(packageJson.scripts).toEqual(
      expect.objectContaining({
        "desktop:dev": "electron desktop/main.cjs",
        "package:desktop": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-desktop.ps1"
      })
    );
  });

  it("configures the Electron window for hover fallback capture by default", () => {
    expect(existsSync(mainPath)).toBe(true);
    const main = readFileSync(mainPath, "utf8");

    expect(main).toContain("WINDOW_TITLE");
    expect(main).toContain("DNF\\u8D5E\\u52A9\\u7CFB\\u7EDF");
    expect(main).toContain("http://47.109.149.111:3000/overlay.html");
    expect(main).toContain('url.searchParams.set("desktop", "1")');
    expect(main).toContain('url.searchParams.set("captureBg", normalizeCaptureMode(mode))');
    expect(main).toContain('url.searchParams.set("captureChrome", "0")');
    expect(main).toContain('process.env.STREAMCHARGE_CAPTURE_BG || "transparent"');
    expect(main).toContain('process.env.STREAMCHARGE_DESKTOP_CHROME_MODE || "hover"');
    expect(main).toContain('new Set(["native", "hover"])');
    expect(main).toContain("width: bounds.width || 1920");
    expect(main).toContain("height: bounds.height || 1080");
    expect(main).toContain("transparent: true");
    expect(main).toContain('frame: desktopChromeMode === "native"');
    expect(main).toContain("alwaysOnTop: snapshot.alwaysOnTop ?? false");
    expect(main).toContain("skipTaskbar: false");
  });

  it("only injects the local Windows style wrapper in hover fallback mode", () => {
    const main = readFileSync(mainPath, "utf8");

    expect(main).toContain("normalizeDesktopChromeMode");
    expect(main).toContain('desktopChromeMode !== "hover"');
    expect(main).toContain("injectDesktopChrome");
    expect(main).toContain("mainWindow.webContents.insertCSS");
    expect(main).toContain("mainWindow.webContents.executeJavaScript");
    expect(main).toContain("desktop-capture-chrome");
    expect(main).toContain('html[data-streamcharge-desktop-focused="1"] .desktop-capture-chrome');
    expect(main).toContain("syncDesktopChromeFocusState");
    expect(main).toContain('win.on("focus", syncDesktopChromeFocusState)');
    expect(main).toContain('win.on("blur", syncDesktopChromeFocusState)');
    expect(main).toContain("-webkit-app-region: drag");
    expect(main).toContain("streamChargeDesktop.windowControl");
  });

  it("binds F6 to rebuild the window between native and hover chrome modes", () => {
    const main = readFileSync(mainPath, "utf8");

    expect(main).toContain("F6");
    expect(main).toContain("toggleDesktopChromeMode");
    expect(main).toContain("rebuildWindowForDesktopChromeMode");
    expect(main).toContain("F8");
    expect(main).toContain('setCaptureMode("transparent")');
    expect(main).toContain("F9");
    expect(main).toContain('setCaptureMode("black")');
    expect(main).toContain("F10");
    expect(main).toContain('setCaptureMode("green")');
    expect(main).toContain("F11");
    expect(main).toContain("setAlwaysOnTop");
    expect(main).toContain("F5");
    expect(main).toContain("reloadIgnoringCache");
  });

  it("packages a portable Windows executable into dist desktop output", () => {
    expect(existsSync(packageScriptPath)).toBe(true);
    expect(existsSync(launcherPath)).toBe(true);
    const script = readFileSync(packageScriptPath, "utf8");
    const launcher = readFileSync(launcherPath, "utf8");

    expect(script).toContain("electron-packager");
    expect(script).toContain("DNF$([char]0x8D5E)$([char]0x52A9)$([char]0x7CFB)$([char]0x7EDF)");
    expect(script).toContain("dist\\desktop");
    expect(script).toContain('--ignore="^/node_modules($|/)"');
    expect(script).toContain("$desktopLocalesToKeep");
    expect(script).toContain('"zh-CN"');
    expect(script).toContain('"en-US"');
    expect(script).toContain('$exeName = "$appName.exe"');
    expect(script).toContain("desktop\\SingleExeLauncher.cs");
    expect(script).toContain("csc.exe");
    expect(script).toContain('Join-Path $root "dist\\$appName.exe"');
    expect(script).toContain('[System.IO.File]::Open($singleExePath, [System.IO.FileMode]::Append');
    expect(script).toContain('[System.Text.Encoding]::ASCII.GetBytes("SCZIP1__")');
    expect(launcher).toContain("DNF\\u8D5E\\u52A9\\u7CFB\\u7EDF-win32-x64");
    expect(launcher).toContain("DNF\\u8D5E\\u52A9\\u7CFB\\u7EDF.exe");
  });
});
