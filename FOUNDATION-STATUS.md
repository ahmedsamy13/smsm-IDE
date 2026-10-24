# Desktop foundation status

Milestone 2 completed on 23 October 2026.

## Delivered

- A launchable Windows x64 Code - OSS baseline using VSCodium 1.140.06880.
- `Start Personal IDE.cmd` and a Node launcher accepting a project folder or workspace file.
- An isolated profile under `%LOCALAPPDATA%\PersonalIDE`, a dark theme, and Windows PowerShell as the default interactive terminal.
- A dependency-free example project plus repeatable unit and desktop checks.
- Pinned official release metadata and verified SHA-256 before runtime extraction.

The normal app was launched and its window was observed with the example workspace and inherited file explorer. The app retains VSCodium branding. This milestone integrates a prebuilt foundation; it does not claim that Code - OSS was compiled locally or that the custom interface is finished.

## Verification results

All three launcher tests pass:

1. Inherited Electron/VS Code launch variables are isolated without changing the input environment.
2. Project paths with spaces work and nonexistent paths are rejected.
3. Existing profile settings are preserved.

The successful desktop smoke test ran inside the actual application's extension host and verified:

1. The project folder was opened.
2. A real JavaScript document was opened, edited, saved, and read back from disk.
3. A real Node process completed successfully in the inherited integrated terminal, in the correct project directory, with a PTY attached.

Evidence: [desktop result](C:/Users/smsm/AppData/Local/PersonalIDE/verification/2026-10-23T14-57-24-304Z/result.json) and [desktop log](C:/Users/smsm/AppData/Local/PersonalIDE/verification/2026-10-23T14-57-24-304Z/desktop.log).

Runtime identity:

- Package version: `1.140.06880`; inherited editor API reports `1.140.0`.
- Product commit: `807ba2d6075c29587f884698cd7370c81ab0724c`.
- Extension gallery: `https://open-vsx.org/vscode/gallery`.
- Archive SHA-256: `024ae1e88f431aee300e73c2ece92e42ebde80a7f3c484ff684f455ffa6a6a7f`.
- Archive cache: `D:\personal-ide-build-cache\VSCodium-win32-x64-1.140.06880.zip` (approximately 218 MiB).
- Expanded archive: approximately 636 MiB, under the project-local `.runtime` directory.

## Adjustments and remaining limits

The initial source-compilation plan could not proceed with the available storage and unconfirmed build toolchain. Using an official prebuilt Code - OSS distribution delivered the inherited desktop behavior without those prerequisites. Full source builds remain deferred.

An initial desktop test saved an edit but failed later with filesystem errors while application state and test evidence were inside Documents. A subsequent attempt stalled. The cause was not conclusively established. Moving state and disposable fixtures to the standard Local AppData location resolved the successful verification run. No Windows protection settings were modified.

An attempted cleanup command was rejected by automatic approval review because it did not sufficiently distinguish disposable test processes from editors with potentially unsaved work. That command was not executed; verification proceeded without it.

The regular launcher preserves workspace trust. The observed example window was in Restricted Mode; the user must make their own trust decision for a project before trust-dependent features such as terminals and tasks are available. Only the generated desktop-test fixture used a trust-disabled test profile.

Custom React/Tailwind panels, agent chat, extension migration, an installer, and performance benchmarking are not part of this milestone. No lower-RAM claim is made. Storage is still limited, so further substantial dependency installation needs a fresh capacity check.
