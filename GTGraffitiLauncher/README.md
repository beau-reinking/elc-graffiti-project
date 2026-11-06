# GT Graffiti Launcher

Version 1 opens one local workspace for **Yudo**, **Sylt**, and **OurScene**. The launcher starts the local server and opens the workspace in your default browser. Its Yudo, Sylt, and OurScene shortcuts open the corresponding browser routes; Other apps retains embedded views for unrelated projects. The bundle includes Node, FFmpeg/ffprobe and their dependencies; normal use requires no Terminal or Homebrew installation. No ChatGPT Sites hosting is used.

Yudo can feature an excerpt from your own Sylt recording: choose the interval, prepare and preview the actual exported clip, save it in the private Yudo draft, then explicitly publish. Only the excerpt becomes public. Existing Graffiti namespaces and storage keys are preserved. See [workspace setup, architecture, and acceptance checks](workspace/README.md).

Build: install each app’s pinned npm dependencies once, then run `zsh scripts/build.sh` here. The shared server is http://127.0.0.1:5178. Stop an older standalone server on that port before opening the launcher.

Graffiti sign-in and identity creation run entirely in the full browser. Use current Safari or Chrome on macOS and complete the provider’s passkey prompt yourself. The previous embedded view cannot register provider passkeys without an authorized domain association. Browser sessions and local drafts are separate from the old embedded view; existing Graffiti records are unchanged.

Keep the launcher open while using the workspace. Its status panel offers **Open workspace in browser**, **View Logs**, **Restart Server**, and **Stop Server**. The browser opens only after readiness; a failed or cancelled startup does not open it. If the browser could not be opened, copy http://127.0.0.1:5178 into Safari or Chrome. A separate static web profile is documented in the release checkout’s root README.

The older library workflow below applies to **Other apps**.


A native Mac workspace for your local Graffiti web apps, with an original GT street-art identity. Add a local project once, then open it from a dedicated library without revisiting a terminal.

## Open the app

Unzip **GT Graffiti Launcher.app.zip** beside this source folder, move **GT Graffiti Launcher.app** into Applications, and open it. The supplied build is for Apple Silicon Macs running macOS 14 or later. It is locally signed for development, not Developer ID signed or notarized for public distribution.

1. Click **Add Graffiti app**, then **Choose…** to select a project folder. You can also paste its path into **Project folder** and click **Detect**; this works if the native picker cannot confirm a folder.
2. Review the suggested name, command, and address. Install your project’s dependencies yourself before launching.
3. Confirm the command and local address, then click **Add Graffiti app**.
4. Click **Open**. GT Graffiti Launcher starts the server and opens the Graffiti app inside its workspace once it responds.

JavaScript projects with `dev` or `start` scripts receive suggestions for npm, pnpm, Yarn, or Bun. Vite, Astro, and explicit script ports are recognized. Other web projects work with a manually entered command and address. Detection reads project files; it never installs dependencies or executes a project during setup.

Use each Graffiti app’s **…** menu to start, stop, restart, edit settings, inspect logs, open it in your browser, or remove it. Stop a Graffiti app before editing its configuration or removing it. Removing a Graffiti app only removes its library entry.

**⌘N** adds a Graffiti app, **⌘F** searches, and **⌘1** returns to the library. Favorites appear first, followed by recently used Graffiti apps. Switching views keeps running Graffiti apps and their web views alive. Closing a Graffiti app’s view leaves its server running; reopening that view reloads its page. Quitting asks to stop running Graffiti apps, then cleans up the processes GT Graffiti Launcher started.

## Local by design

- Graffiti apps must serve HTTP on `localhost`, `127.0.0.1`, or `::1`. Match the address and port to your project’s launch command.
- Launch commands execute through your login shell in the selected project folder. Add only projects and commands you trust: these processes have your user’s permissions.
- Embedded pages have no native bridge or access to GT Graffiti Launcher’s controls. Main-frame navigation stays on the configured local endpoint. User-clicked external web links open in the default browser; camera and microphone access are denied in the embedded view.
- Each launch receives its own process group. Stop sends a graceful termination signal, then force-stops remaining children after three seconds. GT Graffiti Launcher never intentionally stops a server it did not start.
- GT Graffiti Launcher checks for occupied ports before launch. If a framework silently switches to a different port, correct the command to enforce a fixed port and update the address.
- A server is ready when the configured address returns an HTTP status from 200 through 399. A slow-start message appears after 15 seconds; startup times out after 90 seconds and the process is stopped.
- Logs are held in memory, limited to approximately 120 KB per Graffiti app, and reset on a new launch. There is no telemetry or cloud account.
- The library is saved atomically to `~/Library/Application Support/GT Graffiti Launcher/library.json`. A corrupt or incompatible library is preserved and cannot be overwritten through the app.

Light and dark appearance follow macOS. The interface uses system controls and typography, keyboard navigation, text alongside status symbols, and no custom motion.

## Build and test

Requires macOS with Xcode 16 or newer (Swift 6). No third-party dependencies or package downloads are required.

```sh
zsh scripts/build.sh
open "../GT Graffiti Launcher.app"
```

The script builds a release executable, creates the `.app` bundle and icon, verifies an ad hoc signature, and creates a ZIP archive. Signing and archiving happen in a temporary folder before copying to the destination, avoiding metadata injected by synced Documents folders. Pass a destination path as its first argument to place the app elsewhere. Set `GT_GRAFFITI_BUILD_DIR` to move build caches outside the source tree.

```sh
CLANG_MODULE_CACHE_PATH="$PWD/.build/module-cache" \
SWIFTPM_MODULECACHE_OVERRIDE="$PWD/.build/module-cache" \
swift test --disable-sandbox
```

The tests exercise URL restrictions, project detection, persistence, process-group cleanup, real HTTP launches, concurrent Graffiti apps, restart, occupied ports, missing folders, failed and unexpected exits, slow starts, cancellation, timeout cleanup, and corrupt-library preservation. Integration tests require permission to bind and connect to loopback sockets and use the Python 3 included with Xcode’s command-line tools.

For an isolated manual test library, launch the executable with `GT_GRAFFITI_LIBRARY_PATH=/absolute/path/library.json`. This avoids touching your normal library.

### Verification

See `VERIFICATION.md` for checks performed on this GT Graffiti Launcher build.

For isolated appearance checks, set `GT_GRAFFITI_APPEARANCE=light` or `dark` when launching the executable. Without this override, the app follows macOS appearance.

## Structure and current limits

`GTGraffitiCore` contains the portable data model, project detection, persistence, and macOS process-group management. The `GTGraffitiLauncher` executable provides the SwiftUI interface, lifecycle coordinator, readiness checks, and isolated WebKit views. Tests cover both targets.

The legacy Other apps library supports local web projects. It does not install packages, host remote apps, manage containers, or provide accounts or synchronization. Graffiti app dependencies and databases remain the project’s responsibility. External authentication flows, file-picker integration, downloads, camera/microphone access, and other browser-dependent capabilities may require opening the Graffiti app in a full browser; the embedded view is intentionally minimal.

Normal application quit is managed; force-quitting or crashing the launcher may leave a server running. If that happens, stop the old process before relaunching the Graffiti app. Public distribution will require Developer ID signing, notarization, and validation on additional macOS versions and Intel hardware.
