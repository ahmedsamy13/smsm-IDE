# Current interface: 0.4.0

The Codex sidebar redesign is documented in CODEX-UI.md. The current automated suite has 30 passing checks. The earlier milestone results below remain historical evidence.

# Codex integration status — 0.3.0

Verified on Windows on 2026-10-23 with official Codex CLI 0.160.1 and ChatGPT Plus sign-in.

Delivered: right sidebar with toggle; React/Tailwind chat; streaming and Stop; draft persistence while hidden; local history; connection/resume; account/model controls; selected project and attachments; sandbox/access controls; command requests; direct file proposals with old/new line numbers and approve/decline; native Diff and guarded restore.

24 unit tests passed, including proposal no-write-before-approval, stale/dirty-buffer rejection, traversal/symlink protection, new files, and decline behavior. Native desktop checks passed. Live Codex proposed two disposable files: the approved file was written and the declined file was not created.

Evidence:
- %LOCALAPPDATA%/PersonalIDE/verification/2026-10-23T19-54-28-505Z/result.json — live approve/decline plus sidebar and Console.
- %LOCALAPPDATA%/PersonalIDE/verification/2026-10-23T20-00-14-903Z/result.json — final SQLite compatibility repair, REST Client, Console, sidebar, Docker readiness and SSH checks.
- %LOCALAPPDATA%/PersonalIDE/codex-verification/live-1792779197012/result.json — prior real streaming, project context, command and review verification.

The CLI was already signed in; a fresh browser sign-in was not repeated. Command side effects are not universally intercepted or reversible. Review snapshots are bounded and temporary. Codex is the sole agent provider. See CODEX.md for access semantics and limits.
