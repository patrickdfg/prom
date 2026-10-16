using System;
using System.Diagnostics;
using System.Drawing;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace PromBridge
{
    public sealed class PresentationWindow
    {
        public IntPtr Handle;
        public string Title;
        public bool InFront;
    }
    public interface IWindowBackend
    {
        PresentationWindow Find();
        bool Order(PresentationWindow window, bool front);
    }
    public sealed class NativeWindows : IWindowBackend
    {
        private delegate bool Callback(IntPtr hwnd, IntPtr data);
        [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] private struct Point { public int X, Y; }
        [StructLayout(LayoutKind.Sequential)] private struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }
        [DllImport("user32.dll")] private static extern bool EnumWindows(Callback cb, IntPtr data);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr h, StringBuilder text, int max);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr h, out Rect rect);
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
        [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(Point point);
        [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr h, uint flag);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr h, int command);
        [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);

        public static bool IsFullscreenProjector(string process, string title, Rectangle window, Rectangle monitor)
        {
            if (process != "obs64" && process != "obs32" && process != "obs") return false;
            if (title.StartsWith("OBS ", StringComparison.OrdinalIgnoreCase)) return false;
            if (title.IndexOf("projector", StringComparison.OrdinalIgnoreCase) < 0 && !title.Contains("프로젝터")) return false;
            if (monitor.Width <= 0 || monitor.Height <= 0) return false;
            return Math.Abs((long)window.Left - monitor.Left) <= 2 && Math.Abs((long)window.Top - monitor.Top) <= 2
                && Math.Abs((long)window.Right - monitor.Right) <= 2 && Math.Abs((long)window.Bottom - monitor.Bottom) <= 2;
        }
        public PresentationWindow Find()
        {
            PresentationWindow result = null;
            int matches = 0;
            EnumWindows(delegate(IntPtr hwnd, IntPtr unused) {
                if (!IsWindowVisible(hwnd) || IsIconic(hwnd)) return true;
                var text = new StringBuilder(512);
                GetWindowText(hwnd, text, text.Capacity);
                string title = text.ToString();
                uint pid;
                GetWindowThreadProcessId(hwnd, out pid);
                string process;
                try {
                    using (Process p = Process.GetProcessById((int)pid)) {
                        process = p.ProcessName;
                    }
                } catch (ArgumentException) { return true; }
                  catch (InvalidOperationException) { return true; }
                  catch (System.ComponentModel.Win32Exception) { return true; }
                Rect bounds;
                var monitor = new MonitorInfo { Size = Marshal.SizeOf(typeof(MonitorInfo)) };
                if (!GetWindowRect(hwnd, out bounds) || !GetMonitorInfo(MonitorFromWindow(hwnd, 2), ref monitor)) return true;
                if (!IsFullscreenProjector(process, title, Rectangle.FromLTRB(bounds.Left, bounds.Top, bounds.Right, bounds.Bottom),
                    Rectangle.FromLTRB(monitor.Monitor.Left, monitor.Monitor.Top, monitor.Monitor.Right, monitor.Monitor.Bottom))) return true;
                bool front = false;
                var center = new Point { X = bounds.Left + (bounds.Right - bounds.Left) / 2, Y = bounds.Top + (bounds.Bottom - bounds.Top) / 2 };
                front = GetAncestor(WindowFromPoint(center), 2) == hwnd;
                result = new PresentationWindow { Handle = hwnd, Title = title, InFront = front };
                matches++;
                return matches < 2;
            }, IntPtr.Zero);
            // Do not choose an arbitrary monitor if multiple fullscreen projectors exist.
            return matches == 1 ? result : null;
        }
        public bool Order(PresentationWindow window, bool front)
        {
            if (front) ShowWindow(window.Handle, 4);
            // Keep location, size, keyboard focus and owner order unchanged.
            return SetWindowPos(window.Handle, new IntPtr(front ? -1 : 1), 0, 0, 0, 0, 0x0213);
        }
    }
    public sealed class Switcher
    {
        private readonly object gate = new object();
        private readonly IWindowBackend backend;
        public Switcher(IWindowBackend backend) { this.backend = backend; }
        public PresentationWindow Inspect() { lock (gate) return backend.Find(); }
        public bool Switch(string action, out string message)
        {
            lock (gate) {
                PresentationWindow window = backend.Find();
                if (window == null) { message = "OBS 전체화면 프로젝터 창을 하나만 열어 주세요."; return false; }
                bool front;
                if (action == "toggle") front = !window.InFront;
                else if (action == "slideshow") front = false;
                else if (action == "obs") front = true;
                else { message = "알 수 없는 요청입니다."; return false; }
                if (!backend.Order(window, front)) { message = "창 전환에 실패했습니다. 다시 시도해 주세요."; return false; }
                message = front ? "OBS 전체화면을 앞으로 가져왔습니다." : "OBS 전체화면을 뒤로 보냈습니다. 슬라이드가 표시됩니다.";
                return true;
            }
        }
    }
    public sealed class BridgeServer : IDisposable
    {
        public const string Origin = "https://patrickdfg.github.io";
        private readonly HttpListener listener = new HttpListener();
        private readonly Switcher switcher;
        private readonly Action<string> log;
        private Thread worker;
        public BridgeServer(Switcher switcher, Action<string> log, int port)
        {
            this.switcher = switcher; this.log = log;
            listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
        }
        public void Start()
        {
            listener.Start();
            worker = new Thread(Run) { IsBackground = true, Name = "Prom bridge HTTP" };
            worker.Start();
        }
        private void Run()
        {
            while (listener.IsListening) {
                HttpListenerContext context;
                try { context = listener.GetContext(); }
                catch (HttpListenerException) { break; }
                catch (ObjectDisposedException) { break; }
                try { Handle(context); }
                catch (Exception error) {
                    log("연결 오류: " + error.Message);
                    try { context.Response.StatusCode = 500; } catch { }
                }
                finally { try { context.Response.Close(); } catch { } }
            }
        }
        private void Handle(HttpListenerContext c)
        {
            var r = c.Response;
            r.Headers.Add("Access-Control-Allow-Origin", Origin);
            r.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            r.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
            r.Headers.Add("Access-Control-Allow-Private-Network", "true");
            r.Headers.Add("Cache-Control", "no-store");
            string path = c.Request.Url.AbsolutePath.Trim('/');
            if (c.Request.HttpMethod == "OPTIONS") { r.StatusCode = 204; return; }
            if (c.Request.HttpMethod == "GET" && path == "health") {
                PresentationWindow window = switcher.Inspect();
                string body = "{\"ready\":true,\"app\":\"PromWindowBridge\",\"version\":\"1.1.0\",\"mode\":\"obs-projector-z-order\",\"obs\":" + (window != null ? "true" : "false") + ",\"front\":" + (window != null && window.InFront ? "true" : "false") + "}";
                byte[] bytes = Encoding.UTF8.GetBytes(body);
                r.ContentType = "application/json; charset=utf-8";
                r.OutputStream.Write(bytes, 0, bytes.Length);
                return;
            }
            if (c.Request.HttpMethod != "POST" || c.Request.Headers["Origin"] != Origin || (path != "obs" && path != "slideshow")) { r.StatusCode = 403; return; }
            string message;
            bool ok = switcher.Switch(path, out message);
            r.StatusCode = ok ? 204 : 409;
            log("원고 표식 · " + message);
        }
        public void Dispose()
        {
            listener.Close();
            if (worker != null && worker != Thread.CurrentThread) worker.Join(2000);
        }
    }
    public sealed class BridgeForm : Form
    {
        private const int HotkeyId = 177;
        [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterHotKey(IntPtr hwnd, int id, uint modifiers, uint key);
        [DllImport("user32.dll")] private static extern bool UnregisterHotKey(IntPtr hwnd, int id);
        private readonly Switcher switcher = new Switcher(new NativeWindows());
        private readonly Label status = new Label();
        private readonly Label target = new Label();
        private readonly Label hotkeyStatus = new Label();
        private readonly CheckBox hotkey = new CheckBox();
        private readonly ListBox history = new ListBox();
        private readonly NotifyIcon tray = new NotifyIcon();
        private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        private BridgeServer server;
        private bool quitting, registered, updating;
        private readonly EventWaitHandle showEvent;
        private RegisteredWaitHandle showWait;
        public BridgeForm(EventWaitHandle showEvent)
        {
            this.showEvent = showEvent;
            Text = "OBS 전체화면 전환";
            ClientSize = new Size(570, 450);
            MinimumSize = new Size(586, 489);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("맑은 고딕", 10);
            AutoScaleMode = AutoScaleMode.Font;
            BackColor = Color.FromArgb(245, 247, 251);
            Icon = SystemIcons.Application;
            var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(22), ColumnCount = 1, RowCount = 9 };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            for (int i = 0; i < 9; i++) layout.RowStyles.Add(new RowStyle(i == 6 ? SizeType.Percent : SizeType.Absolute, i == 6 ? 100 : (i == 0 ? 43 : i == 3 || i == 8 ? 46 : 30)));
            layout.Controls.Add(new Label { Text = "OBS 전체화면만 앞 / 뒤 전환", AutoSize = true, Font = new Font("맑은 고딕", 14, FontStyle.Bold), Dock = DockStyle.Fill }, 0, 0);
            status.Dock = DockStyle.Fill; layout.Controls.Add(status, 0, 1);
            target.Dock = DockStyle.Fill; target.AutoEllipsis = true; layout.Controls.Add(target, 0, 2);
            var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
            AddButton(buttons, "PgDn처럼 전환", delegate { Switch("toggle", "버튼"); });
            AddButton(buttons, "전체화면 앞으로", delegate { Switch("obs", "버튼"); });
            AddButton(buttons, "전체화면 뒤로", delegate { Switch("slideshow", "버튼"); });
            layout.Controls.Add(buttons, 0, 3);
            hotkey.Text = "PgDn 키로 OBS 전체화면 앞 / 뒤 전환"; hotkey.AutoSize = true;
            hotkey.CheckedChanged += delegate { if (!updating) UpdateHotkey(); };
            layout.Controls.Add(hotkey, 0, 4);
            hotkeyStatus.Dock = DockStyle.Fill; layout.Controls.Add(hotkeyStatus, 0, 5);
            history.Dock = DockStyle.Fill; history.HorizontalScrollbar = true;
            layout.Controls.Add(history, 0, 6);
            layout.Controls.Add(new Label { Text = "창을 닫아도 트레이에서 계속 실행됩니다.", AutoSize = true, Dock = DockStyle.Fill }, 0, 7);
            var footer = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
            AddButton(footer, "트레이로 숨기기", delegate { Hide(); });
            AddButton(footer, "프로그램 종료", delegate { Quit(); });
            layout.Controls.Add(footer, 0, 8);
            Controls.Add(layout);
            var menu = new ContextMenuStrip();
            menu.Items.Add("상태 창 열기", null, delegate { ShowStatus(); });
            menu.Items.Add("앞 / 뒤 전환 (PgDn)", null, delegate { Switch("toggle", "트레이"); });
            menu.Items.Add("프로그램 종료", null, delegate { Quit(); });
            tray.Icon = Icon; tray.Text = "OBS 전체화면 전환"; tray.ContextMenuStrip = menu;
            tray.DoubleClick += delegate { ShowStatus(); };
            tray.Visible = true;
            timer.Interval = 1500; timer.Tick += delegate { RefreshTarget(); };
        }
        private static void AddButton(Control parent, string text, Action action)
        {
            var button = new Button { Text = text, AutoSize = true, Height = 34, Padding = new Padding(6, 0, 6, 0), FlatStyle = FlatStyle.System };
            button.Click += delegate { action(); }; parent.Controls.Add(button);
        }
        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            try {
                server = new BridgeServer(switcher, Log, 17986); server.Start();
                status.Text = "● 실행 중 · 원고 표식 자동 전환 연결됨"; status.ForeColor = Color.DarkGreen;
                Log("준비 완료. PowerShell 없이 실행 중입니다.");
            } catch (HttpListenerException error) {
                if (server != null) server.Dispose(); server = null;
                status.Text = "● 웹 연결 실패 · 기존 보조 프로그램을 종료한 뒤 다시 실행하세요."; status.ForeColor = Color.Firebrick;
                Log("웹 연결 실패: " + error.Message);
            }
            hotkey.Checked = true;
            RefreshTarget(); timer.Start();
            showWait = ThreadPool.RegisterWaitForSingleObject(showEvent, delegate { if (!IsDisposed) try { BeginInvoke((Action)ShowStatus); } catch (InvalidOperationException) { } }, null, Timeout.Infinite, false);
        }
        private void UpdateHotkey()
        {
            if (registered) { UnregisterHotKey(Handle, HotkeyId); registered = false; }
            if (hotkey.Checked) {
                registered = RegisterHotKey(Handle, HotkeyId, 0x4000, 0x22);
                if (!registered) {
                    updating = true; hotkey.Checked = false; updating = false;
                    hotkeyStatus.Text = "PgDn을 등록하지 못했습니다. 다른 단축키 프로그램을 확인하세요.";
                    hotkeyStatus.ForeColor = Color.Firebrick;
                    return;
                }
            }
            hotkeyStatus.Text = registered ? "PgDn 사용 중 · 원고 넘기기는 다른 키나 버튼을 사용하세요." : "PgDn 꺼짐 · 원래 키 동작을 사용합니다.";
            hotkeyStatus.ForeColor = Color.DimGray;
        }
        private void Switch(string action, string source)
        {
            string message;
            bool ok = switcher.Switch(action, out message);
            Log(source + " · " + message);
            if (!ok && !Visible) { tray.BalloonTipTitle = "화면 전환 확인"; tray.BalloonTipText = message; tray.ShowBalloonTip(2500); }
            RefreshTarget();
        }
        private void RefreshTarget()
        {
            PresentationWindow window = switcher.Inspect();
            target.Text = window == null ? "OBS 전체화면 프로젝터를 하나만 열어 주세요." : (window.InFront ? "앞에 표시 중 · " : "뒤에 표시 중 · ") + window.Title;
        }
        private void Log(string message)
        {
            if (IsDisposed || !IsHandleCreated) return;
            if (InvokeRequired) { try { BeginInvoke((Action<string>)Log, message); } catch (InvalidOperationException) { } return; }
            history.Items.Insert(0, DateTime.Now.ToString("HH:mm:ss") + "  " + message);
            while (history.Items.Count > 50) history.Items.RemoveAt(50);
            RefreshTarget();
        }
        private void ShowStatus() { Show(); WindowState = FormWindowState.Normal; Activate(); }
        private void Quit() { quitting = true; Close(); }
        protected override void WndProc(ref Message m)
        {
            if (m.Msg == 0x0312 && m.WParam.ToInt32() == HotkeyId) { Switch("toggle", "PgDn"); return; }
            base.WndProc(ref m);
        }
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!quitting && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; Hide(); return; }
            timer.Stop();
            if (registered) UnregisterHotKey(Handle, HotkeyId);
            if (showWait != null) showWait.Unregister(null);
            if (server != null) server.Dispose();
            tray.Visible = false; tray.Dispose(); timer.Dispose();
            base.OnFormClosing(e);
        }
    }
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            bool first;
            using (var mutex = new Mutex(true, "Local\\PromWindowBridge.Singleton", out first))
            using (var show = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\PromWindowBridge.Show")) {
                if (!first) { show.Set(); return; }
                Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new BridgeForm(show));
                mutex.ReleaseMutex();
            }
        }
    }
}
