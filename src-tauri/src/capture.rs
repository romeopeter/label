//! Screenshots of anything on the desktop.
//!
//! On macOS Layer steps aside and takes the whole display it's on, then the user
//! chooses the area inside Layer (`ScreenAreaPicker`), where it can be adjusted
//! before it's kept. Other systems use the webview's own screen picker to get the
//! picture: see `captureScreen` in `src/lib/host.ts`, which never calls this
//! command there.

use tauri::{AppHandle, ipc::Response};

/// Returns the screenshot as PNG bytes, or no bytes if nothing was taken.
/// Raw rather than JSON, because a full-screen capture is tens of megabytes.
#[tauri::command]
pub async fn capture_screen(app: AppHandle) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || platform::capture(&app))
        .await
        .map_err(|_| "Layer couldn't take that screenshot.".to_owned())?
        .map(Response::new)
}

#[cfg(not(target_os = "macos"))]
mod platform {
    use tauri::AppHandle;

    pub fn capture(_app: &AppHandle) -> Result<Vec<u8>, String> {
        Err("Layer can't take native screenshots on this system.".to_owned())
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use std::{
        fs,
        io::{self, Read},
        path::Path,
        process::{Command, Stdio},
        thread,
        time::{Duration, Instant},
    };

    use tauri::{AppHandle, Manager, Monitor, WebviewWindow};

    /// An absolute path, so nothing on `PATH` can stand in for the system tool.
    const SCREENCAPTURE: &str = "/usr/sbin/screencapture";

    /// A capture with no picker takes well under a second. This exists because the
    /// window is hidden meanwhile: a stuck tool mustn't strand the user without it.
    const CAPTURE_TIMEOUT: Duration = Duration::from_secs(30);

    const POLL_INTERVAL: Duration = Duration::from_millis(100);

    /// Long enough for the window to leave the screen before it's captured.
    const HIDE_DELAY: Duration = Duration::from_millis(200);

    /// Far above any real display's capture. Only stops a surprise file being
    /// pulled into memory and across IPC.
    const MAX_CAPTURE_BYTES: u64 = 256 * 1024 * 1024;

    const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";

    #[derive(Debug, thiserror::Error)]
    enum CaptureError {
        #[error(
            "Allow Layer under Screen Recording in System Settings > Privacy & Security, then reopen Layer."
        )]
        NoPermission,
        #[error("The screenshot took too long, so Layer stopped it.")]
        TimedOut,
        #[error("Layer couldn't take that screenshot.")]
        Failed,
        #[error("Layer couldn't take that screenshot: {0}")]
        Io(#[from] io::Error),
    }

    // SAFETY: both functions are exported by CoreGraphics since macOS 10.15, take
    // no arguments, return a plain bool and have no preconditions.
    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        safe fn CGPreflightScreenCaptureAccess() -> bool;
        safe fn CGRequestScreenCaptureAccess() -> bool;
    }

    /// A display's place and size, in physical pixels.
    type Area = (i32, i32, u32, u32);

    fn area_of(monitor: &Monitor) -> Area {
        let position = monitor.position();
        let size = monitor.size();
        (position.x, position.y, size.width, size.height)
    }

    /// The tool's number for the display Layer is on. It counts from 1, main display
    /// first, in the order the system lists them, which is the order Tauri does.
    fn display_number(displays: &[Area], current: Area) -> Option<usize> {
        displays
            .iter()
            .position(|&area| area == current)
            .map(|index| index + 1)
    }

    fn display_of(app: &AppHandle) -> Option<usize> {
        let window = app.get_webview_window("main")?;
        let current = area_of(&window.current_monitor().ok()??);
        let displays: Vec<Area> = window
            .available_monitors()
            .ok()?
            .iter()
            .map(area_of)
            .collect();
        display_number(&displays, current)
    }

    /// Hides Layer so it isn't in the way of what's behind it, and always brings
    /// it back, however the capture ends.
    struct HiddenWindow(Option<WebviewWindow>);

    impl HiddenWindow {
        fn new(app: &AppHandle) -> Self {
            let window = app.get_webview_window("main");
            // A window that won't hide is only in the way: still worth capturing.
            if window.as_ref().is_some_and(|window| window.hide().is_ok()) {
                thread::sleep(HIDE_DELAY);
            }
            Self(window)
        }
    }

    impl Drop for HiddenWindow {
        fn drop(&mut self) {
            if let Some(window) = &self.0 {
                // Nothing useful can be done here if these fail, and the capture
                // result is still good.
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    }

    pub fn capture(app: &AppHandle) -> Result<Vec<u8>, String> {
        capture_png(app)
            .map(Option::unwrap_or_default)
            .map_err(|error| error.to_string())
    }

    fn capture_png(app: &AppHandle) -> Result<Option<Vec<u8>>, CaptureError> {
        // Without permission the tool still runs, and returns only the wallpaper.
        if !CGPreflightScreenCaptureAccess() {
            CGRequestScreenCaptureAccess();
            return Err(CaptureError::NoPermission);
        }

        // Private to this user, and removed when dropped.
        let directory = tempfile::Builder::new().prefix("layer-capture").tempdir()?;
        let output = directory.path().join("capture.png");

        let mut command = Command::new(SCREENCAPTURE);
        // Silent, and the whole of one display. Asked before hiding: a hidden
        // window may not know which display it's on.
        command.arg("-x");
        match display_of(app) {
            Some(display) => command.args(["-D", &display.to_string()]),
            None => command.arg("-m"),
        };
        command.arg(&output);

        let _hidden = HiddenWindow::new(app);
        run_tool(command, &output, CAPTURE_TIMEOUT)
    }

    /// Runs the tool until it writes `output`, or it exits without one, which is
    /// how a cancel looks. Saying something on stderr is how a failure looks.
    fn run_tool(
        mut command: Command,
        output: &Path,
        timeout: Duration,
    ) -> Result<Option<Vec<u8>>, CaptureError> {
        let mut child = command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()?;

        let started = Instant::now();
        while child.try_wait()?.is_none() {
            if started.elapsed() > timeout {
                child.kill()?;
                child.wait()?;
                return Err(CaptureError::TimedOut);
            }
            thread::sleep(POLL_INTERVAL);
        }

        if output.exists() {
            return read_capture(output).map(Some);
        }

        let mut complaint = String::new();
        if let Some(mut stderr) = child.stderr.take() {
            stderr.read_to_string(&mut complaint)?;
        }
        if complaint.trim().is_empty() {
            Ok(None)
        } else {
            Err(CaptureError::Failed)
        }
    }

    fn read_capture(path: &Path) -> Result<Vec<u8>, CaptureError> {
        if fs::metadata(path)?.len() > MAX_CAPTURE_BYTES {
            return Err(CaptureError::Failed);
        }
        let bytes = fs::read(path)?;
        if bytes.starts_with(PNG_SIGNATURE) {
            Ok(bytes)
        } else {
            Err(CaptureError::Failed)
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        const SECOND: Duration = Duration::from_secs(1);

        /// A stand-in for the system tool. `$1` is where it should write.
        fn fake_tool(script: &str, output: &Path) -> Command {
            let mut command = Command::new("/bin/sh");
            command.args(["-c", script, "fake-tool"]).arg(output);
            command
        }

        fn output_path() -> (tempfile::TempDir, std::path::PathBuf) {
            let directory = tempfile::tempdir().expect("create temp dir");
            let output = directory.path().join("capture.png");
            (directory, output)
        }

        #[test]
        fn finds_the_display_layer_is_on() {
            let main = (0, 0, 2880, 1800);
            let side = (2880, 0, 3840, 2160);
            assert_eq!(display_number(&[main, side], side), Some(2));
            assert_eq!(display_number(&[main, side], main), Some(1));
            assert_eq!(display_number(&[main], side), None);
        }

        #[test]
        fn returns_the_png_the_tool_wrote() {
            let (_directory, output) = output_path();
            let script = r"printf '\211PNG\r\n\032\nrest' > $1";

            let bytes = run_tool(fake_tool(script, &output), &output, 5 * SECOND)
                .expect("capture succeeds")
                .expect("capture has an image");

            assert!(bytes.starts_with(PNG_SIGNATURE));
            assert!(bytes.ends_with(b"rest"));
        }

        #[test]
        fn no_file_and_no_complaint_is_a_cancel() {
            let (_directory, output) = output_path();

            // Whichever exit code the system uses for a cancel.
            for script in ["exit 0", "exit 1"] {
                let result = run_tool(fake_tool(script, &output), &output, 5 * SECOND);
                assert!(matches!(result, Ok(None)));
            }
        }

        #[test]
        fn no_file_and_a_complaint_is_a_failure() {
            let (_directory, output) = output_path();
            let script = "echo 'could not create image' >&2; exit 1";

            let result = run_tool(fake_tool(script, &output), &output, 5 * SECOND);

            assert!(matches!(result, Err(CaptureError::Failed)));
        }

        #[test]
        fn a_file_that_is_not_a_png_is_a_failure() {
            let (_directory, output) = output_path();

            let result = run_tool(fake_tool("echo nope > $1", &output), &output, 5 * SECOND);

            assert!(matches!(result, Err(CaptureError::Failed)));
        }

        #[test]
        fn a_stuck_tool_is_stopped() {
            let (_directory, output) = output_path();
            let started = Instant::now();

            let result = run_tool(fake_tool("exec sleep 30", &output), &output, SECOND / 2);

            assert!(matches!(result, Err(CaptureError::TimedOut)));
            assert!(started.elapsed() < 10 * SECOND);
        }

        #[test]
        fn a_missing_tool_is_an_error_not_a_cancel() {
            let (_directory, output) = output_path();
            let command = Command::new("/nonexistent/screencapture");

            let result = run_tool(command, &output, SECOND);

            assert!(matches!(result, Err(CaptureError::Io(_))));
        }
    }
}
