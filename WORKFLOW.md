# Fullstack workflow

The IDE uses its inherited TypeScript/JavaScript services, Node/browser debugger, Git integration, and task terminal. The Personal IDE interface now adds package-script selection, debugging shortcuts, and a reviewed VS Code import.

## Use it

- Open the project with the launcher or File > Open Folder. Multi-folder workspaces support separate frontend/backend roots.
- Completion: Ctrl+Space; definitions: F12; rename: F2. React TSX/JSX uses the built-in language service and your project types.
- Format: Shift+Alt+F. Prettier is the default for JS, TS, JSX, TSX, JSON, CSS, SCSS, and HTML. Format on Save and explicit ESLint save fixes are enabled only if no user value already exists.
- Lint: ESLint uses the project's installed ESLint and configuration. Working directories are detected automatically. The IDE does not install packages or generate config simply because a project is opened.
- Package scripts: choose Package scripts on the overview, or run Personal IDE: Run Package Script. The picker reads each workspace root's package.json. It recognizes npm, pnpm, Yarn, and Bun from packageManager or lockfiles; the chosen manager must be installed. Nested packages should be opened as workspace roots or invoked through the root's scripts.
- Debug: choose Run and debug. Open your launch configurations or a JavaScript Debug Terminal. Run the project's dev script there to debug Node-side code.
- Git: use Source control or Ctrl+Shift+G. Existing repositories and installed Git are used. Accounts and credentials are not migrated.

## Installed extensions

| Extension                 | Version |
| ------------------------- | ------- |
| Prettier                  | 12.4.0  |
| ESLint                    | 3.0.34  |
| Tailwind CSS IntelliSense | 0.16.0  |

The VSIX packages came from Open VSX and were checked against SHA-256 digests recorded in workflow.lock.json. They are installed in the isolated Personal IDE profile, not your VS Code profile.

For another machine, run node scripts/setup-workflow.mjs after preparing the foundation and building the interface. Existing setting values are kept; a settings backup is made before defaults are added.

## Debugging your frameworks

The optional templates/launch.json contains examples for a current JavaScript file, Next's dev script, Nest's start:dev script, compiled Nest output, and an Edge session for a Vite frontend. Adapt names, URLs, and output paths to your project. Merge only the entries you need into your existing launch.json.

TypeScript debugging needs the project's existing runner or compiled output with source maps. React/browser debugging needs a running development server. These templates do not install a runtime, start a database, or replace project configuration.

## Import from VS Code

Use Import from VS Code on the workspace overview or Personal IDE: Import from VS Code in the command palette.

1. The importer reads the default Code/User/settings.json as JSONC and inventories installed extension IDs.
2. It opens a preview of supported values, conflicts, excluded settings, and extensions available through Open VSX.
3. Select any extensions you want; none are selected by default.
4. Confirm the reviewed import. Existing IDE values are preserved, including values changed after the preview.
5. Applied items and failures are written to the extension's global storage. Failed items are shown separately.

Only a limited set of editor/formatting/linting settings is supported. Account settings, terminal environments, executable paths, and unrecognized keys are excluded. It does not copy auth files, API credentials, Microsoft Settings Sync sessions, or keyboard shortcuts. A separate custom VS Code profile/Insiders import is not implemented.

Extension imports require a compatible editor engine and platform, a recognized open-source license, and a registry checksum. Unavailable or proprietary extensions are skipped for manual review. Review installed extensions as you would any software; the importer does not promise compatibility for every VS Code extension. No settings or optional extensions were imported on your behalf during setup.

## Rebuild

The source is in interface/src. Build with npm --prefix interface run build; the Windows launcher copies the compiled extension into the isolated profile. Reload the IDE window to activate updated extension code. Runtime operation uses bundled files and does not require a development server.

On this machine interface/node_modules links to the dedicated D: build cache because dependency writes under Documents stalled. package.json and package-lock.json retain the dependency graph for a normal npm ci on another machine.

## Verification

Run npm test for launcher/import checks and node scripts/verify-desktop.mjs --workflow for the desktop integration checks. The latter uses a separate local fixture, repository, and test-only trusted profile. It does not run or change your projects. The fixture's lint dependencies currently reside under D:/personal-ide-build-cache/workflow-tools.
