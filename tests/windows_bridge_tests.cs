using System;
using System.Net;
using System.IO;
using System.Drawing;
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
            var monitor = new Rectangle(1920, 0, 2048, 1152);
            Check(NativeWindows.IsFullscreenProjector("obs64", "프로젝터 - 미리보기", monitor, monitor), "OBS 32 fullscreen preview must match");
            Check(NativeWindows.IsFullscreenProjector("obs64", "Fullscreen Projector (Program)", monitor, monitor), "fullscreen program projector must match");
            Check(!NativeWindows.IsFullscreenProjector("obs64", "OBS 32.0.2 - 프로파일: 프로젝터", monitor, monitor), "OBS editor must never match");
            Check(!NativeWindows.IsFullscreenProjector("obs64", "프로젝터 - 미리보기", new Rectangle(1920, 0, 800, 600), monitor), "windowed projector must never match");
            Check(!NativeWindows.IsFullscreenProjector("chrome", "Fullscreen Projector", monitor, monitor), "Chrome must never match");
            Check(!NativeWindows.IsFullscreenProjector("obs64", "설정", monitor, monitor), "OBS dialogs must never match");
            Check(!NativeWindows.IsFullscreenProjector("obs64", "프로젝터 - 미리보기", new Rectangle(1912, -8, 2064, 1168), monitor), "maximized bordered projector must not count as fullscreen");
            var fake = new FakeWindows(); var switcher = new Switcher(fake); string message;
            Check(switcher.Switch("toggle", out message) && !fake.LastFront, "first PgDn must lower a visible OBS projector");
            Check(switcher.Switch("toggle", out message) && fake.LastFront, "second PgDn must raise OBS projector");
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
            Console.WriteLine("PASS fullscreen OBS projector selection, editor/windowed/Chrome exclusions, PgDn toggle, cues, missing window, Win32 failure, HTTP checks, error recovery, shutdown");
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
