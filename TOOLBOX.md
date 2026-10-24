# Development toolbox

## Files and layout
Explorer remains on the left. Material icons distinguish common framework files and folder names. The custom dark theme uses blue as its secondary accent. Codex lives in the right auxiliary sidebar; Ctrl+Alt+I toggles it without discarding your draft.

## JavaScript Console
Save a .js, .mjs, or .cjs file, then press Ctrl+Alt+N or its editor Run button. The bottom Console tab captures stdout, stderr, and exit status. Stop terminates only that run. Use the terminal for interactive input; use Debug Console for debugger evaluation. TypeScript should run through your project's scripts or debugger.

## API requests
Development Tools → API requests opens an editable .http request file. Use REST Client's Send Request above a request, or Ctrl+Alt+R. Change the URL to your running service. Keep credentials out of committed files.

## SQLite
Development Tools → Database lets you open a SQLite database or create a sample. Expand SQLITE EXPLORER to browse tables and execute queries. This release includes SQLite 3.54.1 and an attributed Apache-2.0 compatibility fork of vscode-sqlite 0.14.1 fixing schema string quoting. Database writes require valid SQL and normal care.

## Containers
Development Tools → Docker checks the engine on demand and opens Container Tools. Docker Desktop/its engine and WSL are not installed on this machine. The setup action opens the official instructions; installation and any Windows restart are a separate operating-system setup step. Containers do not start automatically.

## Optional remote work
Keep working locally by default: no remote computer is needed. Remote development → Connect using SSH opens the compatible SSH extension. A remote host, username, and authentication are needed to actually connect. The local SSH client is available; no remote session has been verified without a host.

## Performance
Extensions and Codex activate as needed. The Console keeps bounded output and only one active run. Extension background auto-update checks and Git autofetch default off in fresh profiles. Existing user preferences are preserved. This inherits an Electron/VS Code runtime and is not a tiny native editor; see RELEASE-STATUS.md for measured resource use.
