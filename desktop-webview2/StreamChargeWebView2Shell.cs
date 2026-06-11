using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class StreamChargeWebView2Shell : Form
{
    private const string DefaultOverlayUrl = "http://47.109.149.111:3000/overlay.html";
    private const string WindowTitle = "DNF\u8D5E\u52A9\u7CFB\u7EDF";
    private const string RuntimeInstallerFileName = "MicrosoftEdgeWebview2Setup.exe";
    private const string RuntimeInstallerUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
    private const string WebView2BrowserArguments = "--autoplay-policy=no-user-gesture-required";
    private const int WindowHitTestEdgeSize = 8;
    private const int WindowDragCaptionHeight = 36;
    private const int WM_NCLBUTTONDOWN = 0x00A1;
    private const int HTCAPTION = 2;
    private const int HTLEFT = 10;
    private const int HTRIGHT = 11;
    private const int HTTOP = 12;
    private const int HTTOPLEFT = 13;
    private const int HTTOPRIGHT = 14;
    private const int HTBOTTOM = 15;
    private const int HTBOTTOMLEFT = 16;
    private const int HTBOTTOMRIGHT = 17;
    private static readonly Color TransparentKeyColor = Color.FromArgb(1, 2, 3);

    private WebView2 webView;
    private readonly Timer hoverChromeGuardTimer;
    private string captureBackground = "transparent";
    private bool webViewReady;

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new StreamChargeWebView2Shell());
    }

    private StreamChargeWebView2Shell()
    {
        Text = WindowTitle;
        Width = 1920;
        Height = 1080;
        MinimumSize = new Size(640, 360);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.None;
        KeyPreview = true;
        BackColor = TransparentKeyColor;
        TransparencyKey = TransparentKeyColor;
        hoverChromeGuardTimer = new Timer { Interval = 300 };
        hoverChromeGuardTimer.Tick += (_sender, _event) => ForceHideHoverChromeIfNeeded();
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        await InitializeWebViewAsync();
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        Keys key = keyData & Keys.KeyCode;

        if (key == Keys.F5)
        {
            ReloadOverlay();
            return true;
        }

        if (key == Keys.F6)
        {
            ToggleNativeChrome();
            return true;
        }

        if (key == Keys.F8)
        {
            SetCaptureBackground("transparent");
            return true;
        }

        if (key == Keys.F9)
        {
            SetCaptureBackground("black");
            return true;
        }

        if (key == Keys.F10)
        {
            SetCaptureBackground("green");
            return true;
        }

        if (key == Keys.F11)
        {
            TopMost = !TopMost;
            return true;
        }

        return base.ProcessCmdKey(ref msg, keyData);
    }

    private async Task InitializeWebViewAsync()
    {
        if (!EnsureWebView2RuntimeAvailable())
        {
            Close();
            return;
        }

        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        webView.AllowExternalDrop = false;
        webView.DefaultBackgroundColor = Color.Transparent;
        Controls.Add(webView);

        try
        {
            CoreWebView2EnvironmentOptions environmentOptions = CreateWebView2EnvironmentOptions();
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, GetUserDataFolder(), environmentOptions);
            await webView.EnsureCoreWebView2Async(environment);
            // Electron uses a transparent browser surface. In WebView2 WinForms the
            // equivalent public API is WebView2.DefaultBackgroundColor, backed by
            // CoreWebView2Controller.DefaultBackgroundColor.
            webView.DefaultBackgroundColor = Color.Transparent;
            webView.CoreWebView2.WebMessageReceived += HandleWebMessageReceived;
            await InstallWindowHitTestScriptAsync();
            webViewReady = true;
            StartHoverChromeGuardTimer();
            NavigateOverlay();
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "\u542F\u52A8 WebView2 \u7A97\u53E3\u5931\u8D25\uFF1A\r\n" + error.Message,
                WindowTitle,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            Close();
        }
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        hoverChromeGuardTimer.Stop();
        hoverChromeGuardTimer.Dispose();
        base.OnFormClosed(e);
    }

    private static CoreWebView2EnvironmentOptions CreateWebView2EnvironmentOptions()
    {
        return new CoreWebView2EnvironmentOptions(
            WebView2BrowserArguments,
            null,
            null,
            false,
            null
        );
    }

    private Task InstallWindowHitTestScriptAsync()
    {
        if (webView == null || webView.CoreWebView2 == null)
        {
            return Task.FromResult(0);
        }

        return webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(BuildWindowHitTestScript());
    }

    private void StartHoverChromeGuardTimer()
    {
        hoverChromeGuardTimer.Start();
    }

    private void ForceHideHoverChromeIfNeeded()
    {
        if (!webViewReady || webView == null || webView.CoreWebView2 == null || IsDisposed)
        {
            return;
        }

        bool pointerInsideWindow = ClientRectangle.Contains(PointToClient(Cursor.Position));
        if (ContainsFocus && pointerInsideWindow)
        {
            return;
        }

        Task hideTask = webView.CoreWebView2.ExecuteScriptAsync(
            "document.documentElement.removeAttribute(\"data-streamcharge-webview2-hover\");"
        );
        GC.KeepAlive(hideTask);
    }

    private static string BuildWindowHitTestScript()
    {
        return @"
(() => {
  if (window.__streamChargeWindowHitTestInstalled) {
    return;
  }

  window.__streamChargeWindowHitTestInstalled = true;
  const title = " + ToJavaScriptString(WindowTitle) + @";
  const WindowHitTestEdgeSize = " + WindowHitTestEdgeSize + @";
  const WindowDragCaptionHeight = " + WindowDragCaptionHeight + @";

  const interactiveSelector = [
    'a',
    'button',
    'input',
    'select',
    'textarea',
    '[contenteditable=""true""]',
    '[role=""button""]',
    '.streamcharge-webview2-button',
    '.overlay-widget',
    '.overlay-editor-panel',
    '.overlay-room-panel',
    '.overlay-charge-shape-popover'
  ].join(',');

  function postWindowMessage(message) {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(message);
    }
  }

  function setHoverChromeVisible(visible) {
    if (visible) {
      document.documentElement.setAttribute(""data-streamcharge-webview2-hover"", ""1"");
      return;
    }

    document.documentElement.removeAttribute(""data-streamcharge-webview2-hover"");
  }

  function installHoverChrome() {
    if (document.querySelector('.streamcharge-webview2-chrome')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'streamcharge-webview2-chrome-style';
    style.textContent = `
.streamcharge-webview2-chrome {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  opacity: 0;
  pointer-events: none;
  color: #f7fbff;
  font-family: ""Microsoft YaHei"", ""Segoe UI"", sans-serif;
  transition: opacity 120ms ease;
}

html[data-streamcharge-webview2-hover=""1""] .streamcharge-webview2-chrome {
  opacity: 1;
}

html[data-streamcharge-webview2-hover=""1""] .streamcharge-webview2-titlebar,
html[data-streamcharge-webview2-hover=""1""] .streamcharge-webview2-controls,
html[data-streamcharge-webview2-hover=""1""] .streamcharge-webview2-button {
  pointer-events: auto;
}

.streamcharge-webview2-titlebar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: ${WindowDragCaptionHeight}px;
  display: flex;
  align-items: center;
  padding-left: 12px;
  background: rgba(18, 24, 34, 0.86);
  border-bottom: 1px solid rgba(255, 255, 255, 0.34);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.68), 0 8px 18px rgba(0, 0, 0, 0.24);
  cursor: move;
  user-select: none;
}

.streamcharge-webview2-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
}

.streamcharge-webview2-controls {
  height: 100%;
  margin-left: auto;
  display: flex;
  align-items: stretch;
}

.streamcharge-webview2-button {
  width: 46px;
  height: ${WindowDragCaptionHeight}px;
  border: 0;
  margin: 0;
  padding: 0;
  color: #f7fbff;
  background: transparent;
  font: 16px/1 ""Segoe UI"", sans-serif;
  text-align: center;
  cursor: default;
}

.streamcharge-webview2-button:hover {
  background: rgba(255, 255, 255, 0.18);
}

.streamcharge-webview2-button.is-close:hover {
  background: #c42b1c;
}

.streamcharge-webview2-border {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(245, 250, 255, 0.74);
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.62),
    0 0 0 1px rgba(0, 0, 0, 0.48);
}
`;

    const chrome = document.createElement('div');
    chrome.className = 'streamcharge-webview2-chrome';
    chrome.innerHTML = [
      '<div class=""streamcharge-webview2-border""></div>',
      '<div class=""streamcharge-webview2-titlebar"">',
      '  <div class=""streamcharge-webview2-title""></div>',
      '  <div class=""streamcharge-webview2-controls"">',
      '    <button class=""streamcharge-webview2-button"" type=""button"" data-window-action=""WINDOW_MINIMIZE"" aria-label=""minimize"">-</button>',
      '    <button class=""streamcharge-webview2-button"" type=""button"" data-window-action=""WINDOW_MAXIMIZE"" aria-label=""maximize"">&#9633;</button>',
      '    <button class=""streamcharge-webview2-button is-close"" type=""button"" data-window-action=""WINDOW_CLOSE"" aria-label=""close"">&#215;</button>',
      '  </div>',
      '</div>'
    ].join('');

    chrome.querySelector('.streamcharge-webview2-title').textContent = title;
    chrome.querySelectorAll('[data-window-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        postWindowMessage(button.dataset.windowAction);
      });
    });

    (document.head || document.documentElement).appendChild(style);
    document.body.appendChild(chrome);
  }

  function installHoverChromeWhenReady() {
    if (document.body) {
      installHoverChrome();
      return;
    }

    document.addEventListener('DOMContentLoaded', installHoverChrome, { once: true });
  }

  installHoverChromeWhenReady();

  window.addEventListener('mouseenter', () => setHoverChromeVisible(true), true);
  window.addEventListener('mousemove', () => setHoverChromeVisible(true), true);
  window.addEventListener('mouseleave', () => setHoverChromeVisible(false), true);
  window.addEventListener('blur', () => setHoverChromeVisible(false), true);

  function findWindowHitTarget(event) {
    if (event.target.closest('.streamcharge-webview2-button')) {
      return '';
    }

    const x = event.clientX;
    const y = event.clientY;
    const width = window.innerWidth || document.documentElement.clientWidth;
    const height = window.innerHeight || document.documentElement.clientHeight;
    const left = x <= WindowHitTestEdgeSize;
    const right = x >= width - WindowHitTestEdgeSize;
    const top = y <= WindowHitTestEdgeSize;
    const bottom = y >= height - WindowHitTestEdgeSize;

    if (top && left) return 'HTTOPLEFT';
    if (top && right) return 'HTTOPRIGHT';
    if (bottom && left) return 'HTBOTTOMLEFT';
    if (bottom && right) return 'HTBOTTOMRIGHT';
    if (left) return 'HTLEFT';
    if (right) return 'HTRIGHT';
    if (top) return 'HTTOP';
    if (bottom) return 'HTBOTTOM';

    if (y <= WindowDragCaptionHeight && !event.target.closest(interactiveSelector)) {
      return 'HTCAPTION';
    }

    return '';
  }

  window.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || !window.chrome || !window.chrome.webview) {
      return;
    }

    const hitTarget = findWindowHitTarget(event);
    if (!hitTarget) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    window.chrome.webview.postMessage(hitTarget);
  }, true);
})();
";
    }

    private void HandleWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        string message;
        try
        {
            message = args.TryGetWebMessageAsString();
        }
        catch
        {
            return;
        }

        if (HandleWindowControlMessage(message))
        {
            return;
        }

        int hitTarget = WindowHitTargetToNativeCode(message);
        if (hitTarget == 0)
        {
            return;
        }

        BeginNativeWindowMoveOrResize(hitTarget);
    }

    private bool HandleWindowControlMessage(string message)
    {
        switch (message)
        {
            case "WINDOW_MINIMIZE":
                WindowState = FormWindowState.Minimized;
                return true;
            case "WINDOW_MAXIMIZE":
                WindowState = WindowState == FormWindowState.Maximized
                    ? FormWindowState.Normal
                    : FormWindowState.Maximized;
                return true;
            case "WINDOW_CLOSE":
                Close();
                return true;
            default:
                return false;
        }
    }

    private static int WindowHitTargetToNativeCode(string hitTarget)
    {
        switch (hitTarget)
        {
            case "HTCAPTION":
                return HTCAPTION;
            case "HTLEFT":
                return HTLEFT;
            case "HTRIGHT":
                return HTRIGHT;
            case "HTTOP":
                return HTTOP;
            case "HTTOPLEFT":
                return HTTOPLEFT;
            case "HTTOPRIGHT":
                return HTTOPRIGHT;
            case "HTBOTTOM":
                return HTBOTTOM;
            case "HTBOTTOMLEFT":
                return HTBOTTOMLEFT;
            case "HTBOTTOMRIGHT":
                return HTBOTTOMRIGHT;
            default:
                return 0;
        }
    }

    private void BeginNativeWindowMoveOrResize(int hitTarget)
    {
        if (WindowState == FormWindowState.Maximized)
        {
            return;
        }

        ReleaseCapture();
        SendMessage(Handle, WM_NCLBUTTONDOWN, new IntPtr(hitTarget), IntPtr.Zero);
    }

    private static string GetUserDataFolder()
    {
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "StreamChargeOverlay",
            "webview2-user-data"
        );
    }

    private static bool EnsureWebView2RuntimeAvailable()
    {
        try
        {
            string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            if (!string.IsNullOrWhiteSpace(version))
            {
                return true;
            }
        }
        catch
        {
            // Fall through to the online runtime installer.
        }

        DialogResult choice = MessageBox.Show(
            "\u672A\u68C0\u6D4B\u5230 Microsoft Edge WebView2 \u8FD0\u884C\u5E93\u3002\r\n\r\n\u70B9\u201C\u662F\u201D\u540E\u5C06\u4E0B\u8F7D\u5E76\u5B89\u88C5\u5B98\u65B9\u5728\u7EBF\u8FD0\u884C\u5E93\uFF0C\u5B89\u88C5\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u7EE7\u7EED\u6253\u5F00\u7A97\u53E3\u3002",
            WindowTitle,
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Information
        );

        if (choice != DialogResult.Yes)
        {
            return false;
        }

        try
        {
            string setupPath = Path.Combine(Path.GetTempPath(), RuntimeInstallerFileName);
            using (WebClient client = new WebClient())
            {
                client.DownloadFile(RuntimeInstallerUrl, setupPath);
            }

            using (Process installer = Process.Start(new ProcessStartInfo
            {
                FileName = setupPath,
                Arguments = "/silent /install",
                UseShellExecute = true
            }))
            {
                if (installer != null)
                {
                    installer.WaitForExit(120000);
                }
            }

            string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
            return !string.IsNullOrWhiteSpace(version);
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "WebView2 \u8FD0\u884C\u5E93\u5728\u7EBF\u5B89\u88C5\u5931\u8D25\uFF1A\r\n" + error.Message + "\r\n\r\n\u53EF\u4EE5\u624B\u52A8\u5B89\u88C5\u5B98\u65B9 Microsoft Edge WebView2 Runtime \u540E\u518D\u91CD\u65B0\u6253\u5F00\u3002",
                WindowTitle,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return false;
        }
    }

    private void ReloadOverlay()
    {
        if (!webViewReady || webView == null)
        {
            return;
        }

        if (webView.CoreWebView2 != null)
        {
            webView.CoreWebView2.Reload();
            return;
        }

        NavigateOverlay();
    }

    private void ToggleNativeChrome()
    {
        Rectangle bounds = Bounds;
        FormWindowState state = WindowState;

        if (state == FormWindowState.Maximized)
        {
            WindowState = FormWindowState.Normal;
        }

        FormBorderStyle = FormBorderStyle == FormBorderStyle.Sizable
            ? FormBorderStyle.None
            : FormBorderStyle.Sizable;

        Bounds = bounds;
        WindowState = state;
    }

    private void SetCaptureBackground(string nextBackground)
    {
        captureBackground = NormalizeCaptureBackground(nextBackground);
        NavigateOverlay();
    }

    private void NavigateOverlay()
    {
        if (webView == null)
        {
            return;
        }

        Uri uri = new Uri(BuildOverlayUrl());
        webView.Source = uri;
    }

    private string BuildOverlayUrl()
    {
        Dictionary<string, string> query = new Dictionary<string, string>();
        query["desktop"] = "1";
        query["captureBg"] = captureBackground;
        query["captureChrome"] = "0";

        StringBuilder builder = new StringBuilder(DefaultOverlayUrl);
        builder.Append("?");

        bool first = true;
        foreach (KeyValuePair<string, string> item in query)
        {
            if (!first)
            {
                builder.Append("&");
            }

            builder.Append(Uri.EscapeDataString(item.Key));
            builder.Append("=");
            builder.Append(Uri.EscapeDataString(item.Value));
            first = false;
        }

        return builder.ToString();
    }

    private static string NormalizeCaptureBackground(string value)
    {
        if (value == "black" || value == "green" || value == "transparent")
        {
            return value;
        }

        return "transparent";
    }

    private static string ToJavaScriptString(string value)
    {
        StringBuilder builder = new StringBuilder();
        builder.Append('"');
        foreach (char ch in value)
        {
            switch (ch)
            {
                case '\\':
                    builder.Append("\\\\");
                    break;
                case '"':
                    builder.Append("\\\"");
                    break;
                case '\r':
                    builder.Append("\\r");
                    break;
                case '\n':
                    builder.Append("\\n");
                    break;
                default:
                    if (ch < 32 || ch > 126)
                    {
                        builder.Append("\\u");
                        builder.Append(((int)ch).ToString("x4"));
                    }
                    else
                    {
                        builder.Append(ch);
                    }
                    break;
            }
        }

        builder.Append('"');
        return builder.ToString();
    }

    [DllImport("user32.dll")]
    private static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
}
