import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";

describe("WebView2 desktop shell packaging", () => {
  const shellPath = resolve(process.cwd(), "desktop-webview2/StreamChargeWebView2Shell.cs");
  const launcherPath = resolve(process.cwd(), "desktop-webview2/SingleExeLauncher.cs");
  const packageScriptPath = resolve(process.cwd(), "scripts/package-webview2-desktop.ps1");

  it("keeps the Electron shell and adds separate WebView2 packaging commands", () => {
    expect(packageJson.scripts).toEqual(
      expect.objectContaining({
        "package:desktop": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-desktop.ps1",
        "package:webview2": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-webview2-desktop.ps1"
      })
    );
  });

  it("loads the public overlay with the same capture controls as the Electron shell", () => {
    expect(existsSync(shellPath)).toBe(true);
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("StreamChargeWebView2Shell");
    expect(shell).toContain('private const string WindowTitle = "DNF赞助系统";');
    expect(shell).toContain("http://47.109.149.111:3000/overlay.html");
    expect(shell).toContain('query["desktop"] = "1"');
    expect(shell).toContain('query["captureBg"] = captureBackground');
    expect(shell).toContain('query["captureChrome"] = "0"');
    expect(shell).toContain("CoreWebView2Controller.DefaultBackgroundColor");
    expect(shell).toContain("Color.Transparent");
    expect(shell).toContain("FormBorderStyle = FormBorderStyle.None");
    expect(shell).toContain("FormBorderStyle.Sizable");
    expect(shell).toContain("启动 WebView2 窗口失败：");
    expect(shell).toContain("未检测到 Microsoft Edge WebView2 运行库。");
    expect(shell).toContain("WebView2 运行库在线安装失败：");
  });

  it("defaults to a borderless capture surface and uses invisible web hit zones for moving and resizing", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("FormBorderStyle = FormBorderStyle.None");
    expect(shell).toContain("InstallWindowHitTestScriptAsync");
    expect(shell).toContain("window.chrome.webview.postMessage");
    expect(shell).toContain("WindowHitTestEdgeSize");
    expect(shell).toContain("WindowDragCaptionHeight");
    expect(shell).toContain("CoreWebView2.WebMessageReceived");
    expect(shell).toContain("BeginNativeWindowMoveOrResize");
    expect(shell).toContain("HTCAPTION");
    expect(shell).toContain("HTBOTTOMRIGHT");
  });

  it("injects a hover-only title bar for borderless WebView2 windows", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("streamcharge-webview2-chrome");
    expect(shell).toContain("streamcharge-webview2-titlebar");
    expect(shell).toContain('setAttribute(""data-streamcharge-webview2-hover""');
    expect(shell).toContain('removeAttribute(""data-streamcharge-webview2-hover"")');
    expect(shell).toContain('html[data-streamcharge-webview2-hover=""1""]');
    expect(shell).toContain("mouseenter");
    expect(shell).toContain("mouseleave");
    expect(shell).toContain("WINDOW_MINIMIZE");
    expect(shell).toContain("WINDOW_MAXIMIZE");
    expect(shell).toContain("WINDOW_CLOSE");
    expect(shell).toContain("handleWindowButtonMouseDown");
    expect(shell).toContain("button.addEventListener('mousedown', handleWindowButtonMouseDown)");
    expect(shell).toContain("HandleWindowControlMessage");
  });

  it("uses a host timer to force-hide the hover title bar when the window is not active", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("hoverChromeGuardTimer");
    expect(shell).toContain("StartHoverChromeGuardTimer");
    expect(shell).toContain("ForceHideHoverChromeIfNeeded");
    expect(shell).toContain("ContainsFocus");
    expect(shell).toContain("ClientRectangle.Contains(PointToClient(Cursor.Position))");
    expect(shell).toContain('document.documentElement.removeAttribute(\\"data-streamcharge-webview2-hover\\")');
  });

  it("allows server speech audio to autoplay inside the WebView2 shell", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("CoreWebView2EnvironmentOptions");
    expect(shell).toContain("--autoplay-policy=no-user-gesture-required");
    expect(shell).toContain("CreateWebView2EnvironmentOptions");
    expect(shell).toContain("CoreWebView2Environment.CreateAsync(null, GetUserDataFolder(), environmentOptions)");
  });

  it("enables high DPI rendering and keeps WebView2 at native zoom for sharper capture", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("EnableHighDpiRendering();");
    expect(shell).toContain("SetProcessDpiAwarenessContext");
    expect(shell).toContain("DpiAwarenessContextPerMonitorAwareV2");
    expect(shell).toContain("SetProcessDPIAware");
    expect(shell).toContain("AutoScaleMode = AutoScaleMode.Dpi");
    expect(shell).toContain("webView.ZoomFactor = 1.0;");
    expect(shell).toContain("webView.CoreWebView2.Settings.IsPinchZoomEnabled = false;");
  });

  it("passes Chromium rendering flags that avoid blurry WebView2 scaling", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("--force-device-scale-factor=1");
    expect(shell).toContain("--high-dpi-support=1");
    expect(shell).toContain("--disable-pinch");
    expect(shell).toContain("--enable-gpu-rasterization");
    expect(shell).toContain("--enable-zero-copy");
  });

  it("supports WebView2 runtime online installation and fallback instructions", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("GetAvailableBrowserVersionString");
    expect(shell).toContain("MicrosoftEdgeWebview2Setup.exe");
    expect(shell).toContain("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
    expect(shell).toContain("/silent /install");
    expect(shell).not.toContain("Microsoft.WebView2.FixedVersionRuntime");
  });

  it("keeps the live companion shortcut set in the WebView2 shell", () => {
    const shell = readFileSync(shellPath, "utf8");

    expect(shell).toContain("Keys.F5");
    expect(shell).toContain("ReloadOverlay");
    expect(shell).toContain("Keys.F6");
    expect(shell).toContain("ToggleNativeChrome");
    expect(shell).toContain("Keys.F8");
    expect(shell).toContain('SetCaptureBackground("transparent")');
    expect(shell).toContain("Keys.F9");
    expect(shell).toContain('SetCaptureBackground("black")');
    expect(shell).toContain("Keys.F10");
    expect(shell).toContain('SetCaptureBackground("green")');
    expect(shell).toContain("Keys.F11");
    expect(shell).toContain("TopMost = !TopMost");
  });

  it("packages WebView2 as a small online-runtime single executable", () => {
    expect(existsSync(packageScriptPath)).toBe(true);
    expect(existsSync(launcherPath)).toBe(true);
    const script = readFileSync(packageScriptPath, "utf8");
    const launcher = readFileSync(launcherPath, "utf8");

    expect(script).toContain("Microsoft.Web.WebView2");
    expect(script).toContain("lib\\net462\\Microsoft.Web.WebView2.Core.dll");
    expect(script).toContain("lib\\net462\\Microsoft.Web.WebView2.WinForms.dll");
    expect(script).toContain("runtimes\\win-x64\\native\\WebView2Loader.dll");
    expect(script).toContain("/codepage:65001");
    expect(script).toContain("/utf8output");
    expect(script).toContain("dist\\webview2");
    expect(script).toContain("dist\\DNF$([char]0x8D5E)$([char]0x52A9)$([char]0x7CFB)$([char]0x7EDF)-WebView2.exe");
    expect(script).toContain('[System.Text.Encoding]::ASCII.GetBytes("SCZIP1__")');
    expect(launcher).toContain("SCZIP1__");
    expect(launcher).toContain("webview2");
    expect(launcher).toContain("DNF赞助系统-WebView2");
    expect(launcher).toContain("DNF赞助系统-WebView2.exe");
    expect(launcher).toContain("启动 DNF赞助系统 WebView2 失败：");
    expect(launcher).toContain("单文件包不完整");
    expect(launcher).toContain("单文件包格式不正确");
  });
});
