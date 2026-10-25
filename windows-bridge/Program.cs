using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace PromBridge
{
    public sealed class ToggleHotkey
    {
        public readonly uint Key, Modifiers;
        public ToggleHotkey(uint key, uint modifiers) { Key = key; Modifiers = modifiers; }
        public static ToggleHotkey FromKeys(Keys data)
        {
            Keys key = data & Keys.KeyCode;
            if (key == Keys.None || key == Keys.Escape || key == Keys.F12 || key == Keys.LWin || key == Keys.RWin
                || key == Keys.ShiftKey || key == Keys.ControlKey || key == Keys.Menu
                || key == Keys.LShiftKey || key == Keys.RShiftKey || key == Keys.LControlKey || key == Keys.RControlKey
                || key == Keys.LMenu || key == Keys.RMenu || (uint)key > 254) return null;
            uint modifiers = 0;
            if ((data & Keys.Alt) != 0) modifiers |= 1;
            if ((data & Keys.Control) != 0) modifiers |= 2;
            if ((data & Keys.Shift) != 0) modifiers |= 4;
            return new ToggleHotkey((uint)key, modifiers);
        }
        public override string ToString()
        {
            return ((Modifiers & 2) != 0 ? "Ctrl + " : "") + ((Modifiers & 1) != 0 ? "Alt + " : "")
                + ((Modifiers & 4) != 0 ? "Shift + " : "") + (Key == 0x22 ? "PgDn" : new KeysConverter().ConvertToString((Keys)Key));
        }
        public static ToggleHotkey Load(string path)
        {
            if (!File.Exists(path)) return null;
            string[] parts = File.ReadAllText(path).Trim().Split(',');
            uint key, modifiers;
            if (parts.Length != 2 || !uint.TryParse(parts[0], out key) || key > 254 || !uint.TryParse(parts[1], out modifiers) || modifiers > 7) return null;
            var data = (Keys)key | ((modifiers & 1) != 0 ? Keys.Alt : Keys.None)
                | ((modifiers & 2) != 0 ? Keys.Control : Keys.None) | ((modifiers & 4) != 0 ? Keys.Shift : Keys.None);
            return FromKeys(data);
        }
        public static void Save(string path, ToggleHotkey binding)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            File.WriteAllText(path, binding == null ? "" : binding.Key + "," + binding.Modifiers);
        }
    }
    internal sealed class HotkeyDialog : Form
    {
        private readonly TextBox input = new TextBox();
        private readonly Button save = new Button();
        private readonly Label hint = new Label();
        public ToggleHotkey Binding;
        public HotkeyDialog(ToggleHotkey current)
        {
            Binding = current;
            Text = "OBS 앞 / 뒤 전환 · 토글키 설정";
            ClientSize = new Size(465, 200); FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false; MinimizeBox = false; ShowInTaskbar = false; StartPosition = FormStartPosition.CenterParent;
            Font = new Font("맑은 고딕", 10); AutoScaleMode = AutoScaleMode.Font;
            Controls.Add(new Label { Text = "사용할 키를 누르세요. Ctrl / Alt / Shift 조합도 가능합니다.", AutoSize = true, Location = new Point(20, 18) });
            input.ReadOnly = true; input.Location = new Point(20, 53); input.Size = new Size(420, 30);
            input.Text = current == null ? "여기를 선택하고 원하는 키를 누르세요" : current.ToString();
            input.AccessibleName = "토글 단축키 입력"; Controls.Add(input);
            hint.Text = "이 키를 누를 때마다 OBS 전체화면이 앞 / 뒤로 전환됩니다.";
            hint.Location = new Point(20, 94); hint.Size = new Size(425, 40); Controls.Add(hint);
            save.Text = "저장"; save.Location = new Point(178, 148); save.Size = new Size(80, 32);
            save.Enabled = current != null; save.DialogResult = DialogResult.OK; Controls.Add(save);
            var clear = new Button { Text = "설정 해제", Location = new Point(20, 148), Size = new Size(100, 32) };
            clear.Click += delegate { Binding = null; DialogResult = DialogResult.OK; }; Controls.Add(clear);
            var cancel = new Button { Text = "취소", Location = new Point(272, 148), Size = new Size(80, 32), DialogResult = DialogResult.Cancel };
            Controls.Add(cancel); CancelButton = cancel;
            Shown += delegate { input.Focus(); };
        }
        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (input.Focused) {
                if ((keyData & Keys.KeyCode) == Keys.Escape) { DialogResult = DialogResult.Cancel; return true; }
                ToggleHotkey candidate = ToggleHotkey.FromKeys(keyData);
                if (candidate != null) {
                    Binding = candidate; input.Text = candidate.ToString(); save.Enabled = true;
                    hint.Text = "저장을 누르면 기존 토글키가 이 키로 바뀝니다.";
                }
                return true;
            }
            return base.ProcessCmdKey(ref msg, keyData);
        }
    }
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
        [StructLayout(LayoutKind.Sequential)] private struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }
        [DllImport("user32.dll")] private static extern bool EnumWindows(Callback cb, IntPtr data);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr h, StringBuilder text, int max);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr h);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr h, out Rect rect);
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
        [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr h, uint command);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr h, int command);
        [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int height, uint flags);

        public static bool IsPresentationSurface(Rectangle window, Rectangle monitor)
        {
            if (monitor.Width <= 0 || monitor.Height <= 0 || window.Width <= 0 || window.Height <= 0) return false;
            var center = new System.Drawing.Point(monitor.Left + monitor.Width / 2, monitor.Top + monitor.Height / 2);
            var overlap = Rectangle.Intersect(window, monitor);
            long overlapArea = Math.Max(0, overlap.Width) * (long)Math.Max(0, overlap.Height);
            long monitorArea = monitor.Width * (long)monitor.Height;
            return window.Contains(center) && window.Width >= monitor.Width * 7 / 10 && window.Height >= monitor.Height * 7 / 10
                && overlapArea >= monitorArea * 6 / 10;
        }
        public static bool IsProjectorTitle(string title)
        {
            return !string.IsNullOrEmpty(title) && !title.StartsWith("OBS ", StringComparison.OrdinalIgnoreCase)
                && (title.IndexOf("projector", StringComparison.OrdinalIgnoreCase) >= 0 || title.Contains("프로젝터"));
        }
        public static bool IsFullscreenProjector(string process, string title, Rectangle window, Rectangle monitor)
        {
            if (process != "obs64" && process != "obs32" && process != "obs") return false;
            if (!IsProjectorTitle(title)) return false;
            if (monitor.Width <= 0 || monitor.Height <= 0) return false;
            return Math.Abs((long)window.Left - monitor.Left) <= 2 && Math.Abs((long)window.Top - monitor.Top) <= 2
                && Math.Abs((long)window.Right - monitor.Right) <= 2 && Math.Abs((long)window.Bottom - monitor.Bottom) <= 2;
        }
        public static bool HasCoveringWindow(IntPtr start, Func<IntPtr, IntPtr> previousWindow, Predicate<IntPtr> covers)
        {
            // Hidden windows count in the z-order too. Stop on an actual end/cycle, not an
            // arbitrary number of windows that can hide a real presentation farther up.
            var visited = new HashSet<IntPtr>();
            for (IntPtr window = start; window != IntPtr.Zero && visited.Add(window); window = previousWindow(window)) {
                if (covers(window)) return true;
            }
            return false;
        }
        private static bool IsProjectorInFront(IntPtr projector, Rectangle monitor)
        {
            // Examine z-order instead of WindowFromPoint. The bridge status window or a small popup may cover
            // the monitor centre even while OBS is the visible presentation; only a large presentation surface
            // (PowerPoint, Chrome or another fullscreen window) above OBS means that OBS is behind.
            int ownPid;
            using (var ownProcess = Process.GetCurrentProcess()) { ownPid = ownProcess.Id; }
            return !HasCoveringWindow(GetWindow(projector, 3), h => GetWindow(h, 3), delegate(IntPtr above) {
                if (IsWindowVisible(above) && !IsIconic(above)) {
                    uint pid; GetWindowThreadProcessId(above, out pid);
                    if (pid != ownPid) {
                        Rect rect;
                        if (GetWindowRect(above, out rect)
                            && IsPresentationSurface(Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom), monitor)) return true;
                    }
                }
                return false;
            });
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
                // ProcessName on .NET Framework can enumerate process metadata. Do not do this for
                // every desktop window on every timer tick and hotkey; reject unrelated titles first.
                if (!IsProjectorTitle(title)) return true;
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
                var monitorBounds = Rectangle.FromLTRB(monitor.Monitor.Left, monitor.Monitor.Top, monitor.Monitor.Right, monitor.Monitor.Bottom);
                bool front = IsProjectorInFront(hwnd, monitorBounds);
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
                string body = "{\"ready\":true,\"app\":\"PromWindowBridge\",\"version\":\"1.4.2\",\"mode\":\"obs-projector-z-order\",\"obs\":" + (window != null ? "true" : "false") + ",\"front\":" + (window != null && window.InFront ? "true" : "false") + "}";
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
        private static readonly string ToggleHotkeyPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PromWindowBridge", "toggle-hotkey.txt");
        [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterHotKey(IntPtr hwnd, int id, uint modifiers, uint key);
        [DllImport("user32.dll")] private static extern bool UnregisterHotKey(IntPtr hwnd, int id);
        private readonly Switcher switcher = new Switcher(new NativeWindows());
        private readonly Label status = new Label();
        private readonly Label target = new Label();
        private readonly Label hotkeyStatus = new Label();
        private readonly Label toggleKeyStatus = new Label();
        private readonly CheckBox hotkey = new CheckBox();
        private readonly ListBox history = new ListBox();
        private readonly NotifyIcon tray = new NotifyIcon();
        private readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
        private BridgeServer server;
        private bool quitting, registered, updating;
        private ToggleHotkey toggleBinding;
        private readonly EventWaitHandle showEvent;
        private RegisteredWaitHandle showWait;
        public BridgeForm(EventWaitHandle showEvent)
        {
            this.showEvent = showEvent;
            Text = "OBS 전체화면 전환 · 1.4.2";
            ClientSize = new Size(620, 520);
            MinimumSize = new Size(636, 559);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("맑은 고딕", 10);
            AutoScaleMode = AutoScaleMode.Font;
            BackColor = Color.FromArgb(245, 247, 251);
            Icon = SystemIcons.Application;
            var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(22), ColumnCount = 1, RowCount = 10 };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            for (int i = 0; i < 10; i++) layout.RowStyles.Add(new RowStyle(i == 7 ? SizeType.Percent : SizeType.Absolute, i == 7 ? 100 : (i == 0 ? 43 : i == 3 || i == 6 || i == 9 ? 46 : 30)));
            layout.Controls.Add(new Label { Text = "OBS 전체화면만 앞 / 뒤 · PPT / Chrome 초점 유지", AutoSize = true, Font = new Font("맑은 고딕", 14, FontStyle.Bold), Dock = DockStyle.Fill }, 0, 0);
            status.Dock = DockStyle.Fill; layout.Controls.Add(status, 0, 1);
            target.Dock = DockStyle.Fill; target.AutoEllipsis = true; layout.Controls.Add(target, 0, 2);
            var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
            AddButton(buttons, "앞 / 뒤 전환", delegate { Switch("toggle", "버튼"); });
            AddButton(buttons, "전체화면 앞으로", delegate { Switch("obs", "버튼"); });
            AddButton(buttons, "전체화면 뒤로", delegate { Switch("slideshow", "버튼"); });
            layout.Controls.Add(buttons, 0, 3);
            hotkey.Text = "토글 단축키 사용"; hotkey.AutoSize = true;
            hotkey.CheckedChanged += delegate { if (!updating) UpdateHotkey(); };
            layout.Controls.Add(hotkey, 0, 4);
            hotkeyStatus.Dock = DockStyle.Fill; layout.Controls.Add(hotkeyStatus, 0, 5);
            var backPanel = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
            AddButton(backPanel, "토글키 설정…", ConfigureToggleHotkey);
            toggleKeyStatus.AutoSize = true; toggleKeyStatus.Margin = new Padding(10, 9, 0, 0);
            backPanel.Controls.Add(toggleKeyStatus); layout.Controls.Add(backPanel, 0, 6);
            history.Dock = DockStyle.Fill; history.HorizontalScrollbar = true;
            layout.Controls.Add(history, 0, 7);
            layout.Controls.Add(new Label { Text = "창을 닫아도 트레이에서 계속 실행됩니다.", AutoSize = true, Dock = DockStyle.Fill }, 0, 8);
            var footer = new FlowLayoutPanel { Dock = DockStyle.Fill, WrapContents = false };
            AddButton(footer, "트레이로 숨기기", delegate { Hide(); });
            AddButton(footer, "프로그램 종료", delegate { Quit(); });
            layout.Controls.Add(footer, 0, 9);
            Controls.Add(layout);
            var menu = new ContextMenuStrip();
            menu.Items.Add("상태 창 열기", null, delegate { ShowStatus(); });
            menu.Items.Add("앞 / 뒤 전환", null, delegate { Switch("toggle", "트레이"); });
            menu.Items.Add("토글키 설정…", null, delegate { ShowStatus(); ConfigureToggleHotkey(); });
            menu.Items.Add("프로그램 종료", null, delegate { Quit(); });
            tray.Icon = Icon; tray.Text = "OBS 전체화면 전환 · 1.4.2"; tray.ContextMenuStrip = menu;
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
            toggleBinding = new ToggleHotkey(0x09, 0);
            try {
                if (File.Exists(ToggleHotkeyPath)) {
                    toggleBinding = ToggleHotkey.Load(ToggleHotkeyPath);
                    if (toggleBinding != null && toggleBinding.Key == 0x22 && toggleBinding.Modifiers == 0) {
                        toggleBinding = new ToggleHotkey(0x09, 0);
                        ToggleHotkey.Save(ToggleHotkeyPath, toggleBinding);
                        Log("기존 PgDn 토글키를 Tab으로 바꿨습니다. PgDn은 PPT / Chrome 넘김에 그대로 사용합니다.");
                    }
                }
            }
            catch (IOException error) { Log("단축키 설정 읽기 실패: " + error.Message); }
            catch (UnauthorizedAccessException error) { Log("단축키 설정 읽기 실패: " + error.Message); }
            updating = true; hotkey.Checked = toggleBinding != null; updating = false;
            UpdateHotkey();
            RefreshTarget(); timer.Start();
            showWait = ThreadPool.RegisterWaitForSingleObject(showEvent, delegate { if (!IsDisposed) try { BeginInvoke((Action)ShowStatus); } catch (InvalidOperationException) { } }, null, Timeout.Infinite, false);
        }
        private bool UpdateHotkey()
        {
            if (registered) { UnregisterHotKey(Handle, HotkeyId); registered = false; }
            toggleKeyStatus.Text = toggleBinding == null ? "설정 안 됨" : toggleBinding.ToString();
            if (hotkey.Checked && toggleBinding != null) {
                registered = RegisterHotKey(Handle, HotkeyId, toggleBinding.Modifiers | 0x4000, toggleBinding.Key);
                if (!registered) {
                    hotkeyStatus.Text = toggleBinding + " 등록 실패 · 다른 단축키 프로그램을 확인하세요.";
                    hotkeyStatus.ForeColor = Color.Firebrick;
                    return false;
                }
            }
            hotkeyStatus.Text = registered ? toggleBinding + " 사용 중 · OBS 전체화면만 앞 / 뒤 전환" : "토글 단축키 꺼짐 · 원래 키 동작을 사용합니다.";
            hotkeyStatus.ForeColor = Color.DimGray;
            return true;
        }
        private void ConfigureToggleHotkey()
        {
            ToggleHotkey previous = toggleBinding;
            bool wasEnabled = hotkey.Checked;
            if (registered) { UnregisterHotKey(Handle, HotkeyId); registered = false; }
            using (var dialog = new HotkeyDialog(previous)) {
                if (dialog.ShowDialog(this) != DialogResult.OK) { UpdateHotkey(); return; }
                toggleBinding = dialog.Binding;
            }
            updating = true; hotkey.Checked = toggleBinding != null; updating = false;
            if (!UpdateHotkey()) {
                toggleBinding = previous;
                updating = true; hotkey.Checked = wasEnabled; updating = false;
                UpdateHotkey();
                MessageBox.Show(this, "다른 프로그램에서 사용 중인 키입니다. 이전 토글키를 유지합니다.", "단축키 등록 실패", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            try {
                ToggleHotkey.Save(ToggleHotkeyPath, toggleBinding);
                Log(toggleBinding == null ? "토글 단축키를 해제했습니다." : "토글 단축키 저장: " + toggleBinding);
            } catch (IOException error) { Log("단축키는 적용됐지만 저장하지 못했습니다: " + error.Message); }
              catch (UnauthorizedAccessException error) { Log("단축키는 적용됐지만 저장하지 못했습니다: " + error.Message); }
        }
        private void Switch(string action, string source)
        {
            string message;
            bool ok = switcher.Switch(action, out message);
            Log(source + " · " + message);
            if (!ok && !Visible) { tray.BalloonTipTitle = "화면 전환 확인"; tray.BalloonTipText = message; tray.ShowBalloonTip(2500); }
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
            if (m.Msg == 0x0312 && m.WParam.ToInt32() == HotkeyId && registered) { Switch("toggle", toggleBinding.ToString()); return; }
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
