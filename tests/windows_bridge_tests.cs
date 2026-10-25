using System;
using System.Net;
using System.IO;
using System.Drawing;
using System.Windows.Forms;
using PromBridge;

class FakeWindows : IWindowBackend
{
    public PresentationWindow Slide = new PresentationWindow { Handle = new IntPtr(123), Title = "프로젝터 - 미리보기", InFront = true };
    public bool Success = true, Throw;
    public int Calls;
    public bool LastFront;
    public PresentationWindow Find() { return Slide; }
    public bool Order(PresentationWindow slide, bool front)
    {
        if (Throw) throw new Exception("simulated failure");
        Calls++; LastFront = front;
        if (Success) slide.InFront = front;
        return Success;
    }
}
class FakeFocusWindows : FakeWindows, IPresentationFocus
{
    public IntPtr Active = new IntPtr(456), Presentation = new IntPtr(456), Activated;
    public bool ActivateSuccess = true;
    public int Activations;
    public IntPtr ActiveInputTarget() { return Active; }
    public IntPtr CaptureInputTarget(PresentationWindow projector) { return Presentation; }
    public bool RestoreInputTarget(IntPtr target) {
        Activations++; Activated = target;
        if (!ActivateSuccess || target == IntPtr.Zero) return false;
        Active = target; return true;
    }
}
class Tests
{
    static void Check(bool value, string message) { if (!value) throw new Exception(message); }
    static int Request(string path, string method, string origin, out string body)
    {
        var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:17987/" + path);
        request.Method = method; request.Timeout = 4000; request.Proxy = null;
        if (origin != null) request.Headers["Origin"] = origin;
        if (method == "POST") request.ContentLength = 0;
        HttpWebResponse response;
        try { response = (HttpWebResponse)request.GetResponse(); }
        catch (WebException error) { response = (HttpWebResponse)error.Response; if (response == null) throw; }
        using (response) using (var reader = new StreamReader(response.GetResponseStream())) {
            Check(response.Headers["Access-Control-Allow-Origin"] == BridgeServer.Origin, "CORS origin changed");
            body = reader.ReadToEnd(); return (int)response.StatusCode;
        }
    }
    static int Main()
    {
        try {
            Check(ToggleHotkey.FromKeys(Keys.Control | Keys.Alt | Keys.F8).ToString() == "Ctrl + Alt + F8", "modifier combination capture failed");
            Check(ToggleHotkey.FromKeys(Keys.F8).Key == 119, "plain key capture failed");
            Check(ToggleHotkey.FromKeys(Keys.Next).ToString() == "PgDn", "PgDn capture failed");
            Check(ToggleHotkey.FromKeys(Keys.Tab).Key == 9 && ToggleHotkey.FromKeys(Keys.Tab).ToString() == "Tab", "Tab toggle capture failed");
            Check(ToggleHotkey.FromKeys(Keys.ControlKey) == null && ToggleHotkey.FromKeys(Keys.ShiftKey) == null, "modifier alone must not bind");
            Check(ToggleHotkey.FromKeys(Keys.Escape) == null && ToggleHotkey.FromKeys(Keys.F12) == null && ToggleHotkey.FromKeys(Keys.LWin) == null, "reserved keys must not bind");
            string settingsDirectory = Path.Combine(Path.GetTempPath(), "prom-hotkey-test-" + Guid.NewGuid().ToString("N"));
            string settingsPath = Path.Combine(settingsDirectory, "binding.txt");
            try {
                Check(ToggleHotkey.Load(settingsPath) == null, "missing settings should mean unassigned");
                var chosen = ToggleHotkey.FromKeys(Keys.Control | Keys.Shift | Keys.F9);
                ToggleHotkey.Save(settingsPath, chosen);
                var restored = ToggleHotkey.Load(settingsPath);
                Check(restored.Key == chosen.Key && restored.Modifiers == chosen.Modifiers, "binding must survive restart");
                ToggleHotkey.Save(settingsPath, null); Check(ToggleHotkey.Load(settingsPath) == null, "clear binding must persist");
                File.WriteAllText(settingsPath, "99999,0"); Check(ToggleHotkey.Load(settingsPath) == null, "invalid key must be ignored");
                File.WriteAllText(settingsPath, "119,8"); Check(ToggleHotkey.Load(settingsPath) == null, "unsupported modifiers must be ignored");
            } finally { if (File.Exists(settingsPath)) File.Delete(settingsPath); if (Directory.Exists(settingsDirectory)) Directory.Delete(settingsDirectory); }
            var monitor = new Rectangle(1920, 0, 2048, 1152);
            Check(!NativeWindows.IsProjectorTitle(null) && !NativeWindows.IsProjectorTitle("PPT 만들기 - Chrome"), "unrelated windows must be rejected before process inspection");
            Check(!NativeWindows.IsProjectorTitle("OBS 32.0.2 - 프로젝터") && NativeWindows.IsProjectorTitle("프로젝터 - 미리보기"), "title fast path must preserve projector filtering");
            Check(NativeWindows.IsFullscreenProjector("obs64", "프로젝터 - 미리보기", monitor, monitor), "OBS 32 fullscreen preview must match");
            Check(NativeWindows.IsFullscreenProjector("obs64", "Fullscreen Projector (Program)", monitor, monitor), "fullscreen program projector must match");
            Check(!NativeWindows.IsFullscreenProjector("obs64", "OBS 32.0.2 - 프로파일: 프로젝터", monitor, monitor), "OBS editor must never match");
            Check(!NativeWindows.IsFullscreenProjector("obs64", "프로젝터 - 미리보기", new Rectangle(1920, 0, 800, 600), monitor), "windowed projector must never match");
            Check(!NativeWindows.IsFullscreenProjector("chrome", "Fullscreen Projector", monitor, monitor), "Chrome must never match");
            Check(!NativeWindows.IsFullscreenProjector("obs64", "설정", monitor, monitor), "OBS dialogs must never match");
            Check(!NativeWindows.IsFullscreenProjector("obs64", "프로젝터 - 미리보기", new Rectangle(1912, -8, 2064, 1168), monitor), "maximized bordered projector must not count as fullscreen");
            Check(NativeWindows.IsPresentationSurface(monitor, monitor), "PowerPoint fullscreen must count as a presentation surface");
            Check(NativeWindows.IsPresentationSurface(new Rectangle(1920, 0, 2048, 1110), monitor), "Chrome fullscreen/work-area surface must count");
            Check(!NativeWindows.IsPresentationSurface(new Rectangle(2500, 250, 620, 520), monitor), "bridge status window must not hide OBS front state");
            Check(!NativeWindows.IsPresentationSurface(new Rectangle(1920, 0, 1100, 1152), monitor), "narrow side window must not hide OBS front state");
            Func<IntPtr, IntPtr> previousWindow = h => h.ToInt64() < 600 ? new IntPtr(h.ToInt64() + 1) : IntPtr.Zero;
            Check(NativeWindows.HasCoveringWindow(new IntPtr(1), previousWindow, h => h.ToInt64() == 560), "PPT beyond 512 hidden windows must still cover OBS");
            Check(!NativeWindows.HasCoveringWindow(new IntPtr(1), previousWindow, h => false), "uncovered OBS must remain in front after a long search");
            Check(NativeWindows.HasCoveringWindow(new IntPtr(1), previousWindow, h => h.ToInt64() == 1), "nearest covering window must be detected");
            Check(!NativeWindows.HasCoveringWindow(new IntPtr(1), h => new IntPtr(1), h => false), "changing z-order cycles must terminate");
            Check(!NativeWindows.HasCoveringWindow(IntPtr.Zero, previousWindow, h => true), "empty z-order must not cover OBS");
            Check(NativeWindows.IsInputPresentation("POWERPNT", "screenClass"), "PPT slideshow must be an input destination");
            Check(!NativeWindows.IsInputPresentation("POWERPNT", "PPTFrameClass"), "PPT editor must never be an input destination");
            Check(NativeWindows.IsInputPresentation("chrome", "Chrome_WidgetWin_1"), "Chrome presentation must be an input destination");
            Check(!NativeWindows.IsInputPresentation("obs64", "Chrome_WidgetWin_1"), "other applications must not be mistaken for Chrome");
            var focusWindows = new FakeFocusWindows(); var focusSwitcher = new Switcher(focusWindows); string focusMessage;
            Check(focusSwitcher.Switch("toggle", out focusMessage) && focusWindows.LastFront && focusWindows.Active == focusWindows.Slide.Handle, "Tab from PPT must raise and activate OBS even with stale front state");
            focusWindows.Slide.InFront = false;
            Check(focusSwitcher.Switch("toggle", out focusMessage) && !focusWindows.LastFront && focusWindows.Active == focusWindows.Presentation, "Tab from OBS must lower it and activate PPT even with stale front state");
            Check(focusSwitcher.Switch("toggle", out focusMessage) && focusWindows.Active == focusWindows.Slide.Handle, "repeated Tab must return to OBS");
            focusWindows.Presentation = new IntPtr(789);
            Check(focusSwitcher.Switch("slideshow", out focusMessage) && focusWindows.Active == new IntPtr(789), "return must activate the captured Chrome target too");
            focusWindows.ActivateSuccess = false;
            Check(!focusSwitcher.Switch("obs", out focusMessage) && focusMessage.Contains("입력 활성화에 실패"), "activation failure must not be reported as successful switching");
            int activations = focusWindows.Activations; focusWindows.Success = false;
            Check(!focusSwitcher.Switch("obs", out focusMessage) && focusWindows.Activations == activations, "failed window move must not activate another app");
            focusWindows.Success = true; focusWindows.ActivateSuccess = true; focusWindows.Presentation = IntPtr.Zero;
            Check(!focusSwitcher.Switch("slideshow", out focusMessage), "missing return application must be reported");
            focusWindows.Presentation = new IntPtr(789); focusWindows.Active = focusWindows.Presentation;
            activations = focusWindows.Activations;
            using (var focusServer = new BridgeServer(focusSwitcher, delegate { }, 17987)) {
                focusServer.Start(); string focusBody;
                Check(Request("obs", "POST", BridgeServer.Origin, out focusBody) == 204 && focusWindows.LastFront, "voice start must raise OBS");
                Check(Request("slideshow", "POST", BridgeServer.Origin, out focusBody) == 204 && !focusWindows.LastFront, "voice end must lower OBS");
                Check(focusWindows.Activations == activations && focusWindows.Active == focusWindows.Presentation, "voice cues must not move input away from the recognition browser");
            }
            var fake = new FakeWindows(); var switcher = new Switcher(fake); string message;
            Check(switcher.Switch("toggle", out message) && !fake.LastFront, "first toggle must lower a visible OBS projector");
            Check(switcher.Switch("toggle", out message) && fake.LastFront, "second toggle must raise OBS projector");
            fake.Slide.InFront = false;
            Check(switcher.Switch("toggle", out message) && fake.LastFront, "toggle must respect manual order changes");
            Check(switcher.Switch("obs", out message) && fake.LastFront, "start cue must raise only OBS projector");
            Check(switcher.Switch("slideshow", out message) && !fake.LastFront, "end cue must lower only OBS projector");
            int previous = fake.Calls;
            Check(!switcher.Switch("invalid", out message) && fake.Calls == previous, "unknown action must not affect windows");
            var slide = fake.Slide; fake.Slide = null;
            Check(!switcher.Switch("toggle", out message) && fake.Calls == previous, "missing slideshow must not affect windows");
            fake.Slide = slide; fake.Success = false;
            Check(!switcher.Switch("toggle", out message), "Win32 failure must be reported");
            fake.Success = true;
            using (var server = new BridgeServer(switcher, delegate { }, 17987)) {
                server.Start(); string body;
                Check(Request("health", "GET", null, out body) == 200 && body.Contains("obs-projector-z-order") && body.Contains("\"obs\":true"), "health response invalid");
                previous = fake.Calls;
                Check(Request("obs", "POST", null, out body) == 403, "origin-less switch must be rejected");
                Check(Request("obs", "POST", "https://untrusted.example", out body) == 403, "wrong origin must be rejected");
                Check(Request("toggle", "POST", BridgeServer.Origin, out body) == 403, "unpublished endpoint must be rejected");
                Check(Request("obs", "GET", BridgeServer.Origin, out body) == 403, "GET must not switch windows");
                Check(Request("obs", "OPTIONS", BridgeServer.Origin, out body) == 204, "preflight must work");
                Check(fake.Calls == previous, "rejected/preflight requests must not affect windows");
                Check(Request("obs", "POST", BridgeServer.Origin, out body) == 204 && fake.LastFront, "HTTP start failed");
                Check(Request("slideshow", "POST", BridgeServer.Origin, out body) == 204 && !fake.LastFront, "HTTP end failed");
                fake.Slide = null;
                Check(Request("obs", "POST", BridgeServer.Origin, out body) == 409, "missing slideshow HTTP status invalid");
                fake.Slide = slide; fake.Throw = true;
                Check(Request("obs", "POST", BridgeServer.Origin, out body) == 500, "exception must return 500");
                fake.Throw = false;
                Check(Request("slideshow", "POST", BridgeServer.Origin, out body) == 204, "server must recover after exception");
            }
            Console.WriteLine("PASS hotkey capture/validation/save/load/clear, fullscreen projector selection, PPT/Chrome presentation-surface detection, bridge-popup exclusion, toggle/cues, failure recovery, HTTP checks, shutdown");
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
