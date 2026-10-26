# Personal IDE 0.6.1

Windows desktop IDE built on pinned VSCodium / Code - OSS, with dark blue accents and React + Tailwind custom panels.

## Start
Double-click **Start Personal IDE.cmd**, or install release/PersonalIDE-0.6.1-x64-setup.exe. The launcher uses its bundled runtime; a separate Node installation is not required to open the IDE. Developing Node projects requires Node/npm.

Drag a project folder onto the CMD launcher to open it. Your settings and extensions live in %LOCALAPPDATA%/PersonalIDE.

The Personal IDE interface is bundled into the editor itself, so it loads when opening the app directly or from a desktop shortcut. Codex opens on the right the first time each profile loads the interface; **Ctrl+Alt+I** toggles it afterward.

## Everyday controls
- **Ctrl+Alt+I**: show/hide Codex on the right. Connect Codex uses the official CLI's ChatGPT sign-in.
- **Chat history** (clock icon in Codex): search and reopen saved conversations with their projects. **New Chat (+)** always asks you to choose a project folder from your PC; canceling keeps the current chat. History is stored locally and survives restarts.
- **Ctrl+Alt+N**: run the saved JavaScript file in the bottom Console.
- Left Explorer: files with Material icons and Development Tools.
- Development Tools: containers, SQLite browser, API requests, and optional SSH.
- Status bar **Personal IDE**: overview, terminal, Git, scripts, debugging, and import.

Prettier, ESLint, Tailwind IntelliSense, JS/TS completion, debugging, Git, terminal, and compatible extension/settings import are included. Extensions from Open VSX or compatible VSIX files can be imported; Microsoft-only marketplace services and restricted extensions are not guaranteed.

Codex applies proposed files as it works, then shows **Accept all changes** when its turn ends. Reject all restores the prior contents and removes new files. File and folder additions appear in the Explorer as the agent works; individual decisions remain available in the editor.

See TOOLBOX.md, CODEX.md, WORKFLOW.md, and RELEASE-STATUS.md for setup, tested behavior, and limitations.

## Development
Run npm test, npm --prefix interface run build, or npm run verify:toolbox.
Live Codex verification uses subscription allowance. The installer bundles checksum-verified extensions for offline first launch; signing in and provider requests require network access.

The runtime executable and icon retain VSCodium branding and licenses. This is a personal distribution, not a locally rebuilt engine.

Agent file review: edits apply immediately. Accept keeps changes; Reject restores previous content or deletes new files and empty parent folders created for them. Pending editor reviews survive reconnects and restarts. Later manual edits are protected from automatic rollback.
