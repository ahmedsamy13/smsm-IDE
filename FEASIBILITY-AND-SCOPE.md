# Personal Fullstack IDE: feasibility and scope

Reviewed: 23 October 2026 (Africa/Cairo).

Status: feasibility research complete; scope recorded for the first implementation. No IDE source code, dependency installation, account login, or build was performed. This is a conditional go: local compilation requires storage and toolchain preparation.

Milestone 2 update: a prebuilt VSCodium Code - OSS foundation has since been integrated and verified. Full source compilation remains deferred. See [FOUNDATION-STATUS.md](FOUNDATION-STATUS.md) for the implementation adjustment and measured smoke-test results; the original review below records the planning-stage findings.

## 1. Decision

Build a personal Windows x64 IDE using Code - OSS, TypeScript, and its existing Electron runtime. Keep upstream changes small. Add the custom agent and onboarding panels with React and Tailwind. Preserve the existing editor, workbench, extension host, terminal, debugger, and Git integration.

This is a customized distribution, not a newly written editor engine. A completely new engine conflicts with the goals of straightforward VS Code extension compatibility and manageable implementation effort. The user accepted the foundation-based approach during planning.

Code - OSS is MIT licensed; retain required notices and use original branding rather than Microsoft proprietary assets. See the [source license](https://github.com/microsoft/vscode/blob/main/LICENSE.txt) and [distribution differences](https://code.visualstudio.com/docs/supporting/faq).

## 2. Subscription integrations

These findings describe documented integration routes, not verified access to the user's accounts. Exact plan entitlements, sign-in success, model access, and quotas must be tested during implementation. The current chat does not grant this new IDE account access.

| Provider | Finding | Scope decision |
| --- | --- | --- |
| Codex / ChatGPT | The app-server offers local client authentication, streamed agent events, history, and approvals. Managed ChatGPT authentication supports browser/device flows. The documentation distinguishes local/open-source apps from commercial/hosted services. | First-release agent: local Codex child process over stdio, provider-managed login, no copied tokens. Revisit the auth approach before distribution beyond personal use. |
| Other agents | Third-party subscription access is not portable to this IDE. | Out of scope. Codex is the sole agent provider. |
| Claude | Pro/Max includes the official Claude Code client. However, the subscription help article currently permits SDK/third-party usage, while the SDK overview says third-party products need approval to offer Claude login/rate limits. | Official Claude Code in the integrated terminal is the initial fallback. A custom unified-chat adapter remains conditional on resolving the conflicting guidance and confirming the applicable authentication route. |

Sources: [Codex app-server](https://learn.chatgpt.com/docs/app-server), [Codex authentication](https://learn.chatgpt.com/docs/auth), [Gemini authentication](https://geminicli.com/docs/get-started/authentication/), [Gemini ACP](https://geminicli.com/docs/cli/acp-mode/), [Gemini quota categories](https://geminicli.com/docs/resources/quota-and-pricing/), [Claude subscription support](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan), [Claude SDK subscription update](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), and [Claude Agent SDK restriction](https://code.claude.com/docs/en/agent-sdk/overview).

### Billing and account rules

- Subscription-only is the default. Do not fall back automatically to API keys, API credits, or purchased extra usage.
- Before launching a provider, verify its selected auth mode and prevent unintended inherited API-key configuration. Do not inspect or display secret values.
- Stop on exhausted subscription quota and explain the available next action.
- No separate IDE account, cloud account database, or custom OAuth token collection in the first release.
- Provider switching starts a separate provider session. Cross-provider conversation continuation is not promised; any later transfer must make the selected context visible to the user.
- Store IDE preferences and history locally. Agent requests still send selected project content to the chosen provider; local storage does not mean local inference.

## 3. Extensions and migration

A Code - OSS fork cannot access Microsoft's Visual Studio Marketplace. Microsoft sign-in does not remove that restriction. Extension packages also have individual licenses and compatibility requirements. Use Open VSX and publisher-authorized packages/source builds, with a reviewed VSIX import path. Do not blindly copy the installed extension directory.

The import flow will read settings, shortcuts, and extension IDs; preview changes; resolve compatible packages; and report unavailable items. Credential files and Microsoft Settings Sync authentication are outside migration scope.

Sources: [Microsoft extension and Marketplace limitations](https://code.visualstudio.com/docs/supporting/faq), [Open VSX project](https://github.com/eclipse-openvsx/openvsx), and [Open VSX integration guidance](https://github.com/eclipse-openvsx/openvsx/wiki/Using-Open-VSX-in-VS-Code).

### Candidates found on this machine

Only directory names and selected package manifest fields were read. These observations confirm installed artifacts, not that the packages run in our future build. MIT manifest labels do not establish rights to redistribute a particular Marketplace-acquired binary.

| Extension | Installed version examined | Declared engine / license | First-release treatment |
| --- | --- | --- | --- |
| Prettier (`esbenp.prettier-vscode`) | 12.4.0 | ^1.101.0 / MIT | Core candidate; obtain an authorized artifact and verify project-local formatting. |
| ESLint (`dbaeumer.vscode-eslint`) | 3.0.34 | ^1.90.0 / MIT | Core candidate; use a permitted distribution/source build and test multi-folder linting. |
| Tailwind IntelliSense (`bradlc.vscode-tailwindcss`) | 0.16.0 | ^1.67.0 / MIT | Core candidate; test Tailwind project detection and completion. |
| Material Icon Theme (`PKief.material-icon-theme`) | 5.38.1 | ^1.55.0 / MIT | Optional candidate; not required for core functionality. |
| Pylance (`ms-python.vscode-pylance`) | 2026.2.1 | ^1.107.0 / separate license | Outside JS/TS release scope; no automatic import. |
| Quokka (`WallabyJs.quokka-vscode`) | 1.0.763 | ^1.93.0 / vendor EULA | Optional later; requires vendor-license and compatibility review. |

The [Prettier](https://github.com/prettier/prettier-vscode), [ESLint](https://github.com/microsoft/vscode-eslint), and [Tailwind](https://github.com/tailwindlabs/tailwindcss-intellisense) source repositories provide practical source-build routes. Open VSX pages were located, but its dynamic listing/API metadata could not be fully retrieved by the web tool. Registry artifact versions, publisher provenance, and download/install success remain implementation checks, not completed verification.

## 4. Windows build requirements and local readiness

Upstream documents Git, an appropriate Node version, working Python for node-gyp, and a Windows C++ toolchain. Current instructions specify Visual Studio 2026 Build Tools, a Windows SDK, and architecture-matching Spectre/ATL/MFC components. Follow the selected revision's requirements rather than installing arbitrary latest versions. Use a source path without spaces.

The usual developer sequence is `npm install`, `npm run watch`, then `scripts\\code.bat`; packaging is a separate step. The container guidance recommends 8 GB for the build environment, which is not a promise that an 8 GB Windows host will compile comfortably while other tools run.

Source: [upstream build instructions](https://github.com/microsoft/vscode/wiki/How-to-Contribute). The live main branch [.nvmrc](https://raw.githubusercontent.com/microsoft/vscode/main/.nvmrc) read during this review specifies **24.22.1**. A release tag/commit must be pinned before installation; main is not a locked build target.

| Local check | Observed result | Meaning |
| --- | --- | --- |
| OS architecture | X64; Windows build 26200 | Compatible with the proposed Windows x64 target; Windows 11 is user-reported. |
| Hardware | User reports 8 GB RAM and i5-10500U | Exact CPU/RAM not independently confirmed; CIM inventory was unavailable. |
| Git | 2.51.0.windows.1 | Installed. |
| Node | 22.19.0 | Installed; differs from current main's .nvmrc. |
| npm | 11.5.2 | Installed; compatibility to be checked against the pinned revision. |
| C: free storage | Approximately 5.10 GB | Insufficient planning headroom for toolchains, checkout, dependencies, caches, and packaging. |
| D: free storage | Approximately 1.70 GB | Does not provide an adequate alternate build location currently. |
| Visual Studio inventory | Standard vswhere executable not found | Standard installation not detected; not proof that every possible custom install is absent. |
| Windows SDK | Standard Include directory not found | SDK not detected in its usual location. |
| Python | Commands resolve to WindowsApps aliases; launcher did not execute | Working build Python is unverified. |
| Provider commands | Codex resolves | Other providers are not included. |

**Build gate:** provide more free space and confirm the complete toolchain before downloading the source/dependencies. Budget **at least 40 GB free as a project planning target**, with further capacity if the chosen toolchain needs it. This is our working allowance, not an official upstream minimum or a measured total. An external SSD or separately authorized build machine is an alternative. Nothing was deleted or installed to resolve this gate.

## 5. Locked first-release scope

1. Personal Windows x64 desktop app, dark English interface, original placeholder branding, no mandatory account.
2. Open one folder or a multi-folder workspace; browse, search, edit, save, and navigate JS/TS/JSX/TSX files.
3. Reuse completion, diagnostics, refactoring, terminal, Git, tasks, and debugging from the foundation; verify them in the custom distribution.
4. Recognize React, Next.js, Node.js, Express, and NestJS projects through their existing files and npm scripts. Do not inject dependencies or rewrite configuration merely because a folder was opened.
5. Offer Prettier, ESLint, and Tailwind IntelliSense through authorized compatible packages; honor project configuration.
6. Preview-based migration of local VS Code settings, shortcuts, and extension IDs, with skipped-item reporting.
7. Codex chat: sign-in status, streamed replies, explicit context selection, cancellation, local history, agent edits, command events, and diff review.
8. Access presets: Ask first, Allow project edits, and Full access. Map each to actual provider enforcement. Unsupported restrictions disable the affected capability rather than display a misleading toggle.
9. Review edits against checkpoints without overwriting unrelated user changes. Shell, network, database, deployment, and Git effects cannot all be undone by file checkpoints; the UI must describe the applicable scope.
10. A locally packaged Windows build and a repeatable real-project smoke test. Begin with a portable package; installer creation follows packaging validation. Distribution signing is separate from local usability.

Implementation boundary: keep privileged file/process work out of the React webview. Use validated messages to the host and provider approval mechanisms. Access presets are workflow permissions, not a claim of complete OS isolation for arbitrary shell commands.

Tailwind is required for custom React panels. Keep generated CSS inside those panels; do not apply its global reset to the workbench. Tailwind documents the effects and optional omission of [Preflight](https://tailwindcss.com/docs/preflight). No separate Express/Nest backend, Next.js server, or local model runtime is needed to power the IDE.

## 6. Later scope retained

Docker controls, database browsing, API testing, and remote development use compatible tools loaded on demand. Microsoft Remote Development components are not assumed available to the fork. Docker and database services are external dependencies, not bundled always-on servers.

## 7. Performance acceptance

Performance is unmeasured. Do not promise lower RAM than VS Code, sub-second startup, or a fixed token reduction.

For the first benchmark, use one representative frontend/backend workspace, one terminal, the three core extension candidates, and one active agent. Record startup time, total IDE-process memory, separate provider-process memory, idle CPU, typing/search responsiveness, and memory after closing the agent. Compare an unmodified foundation against the custom build under the same conditions.

Initial engineering goals: no persistent idle CPU load, no continuously running provider when unused, no automatic indexing of node_modules/build output, and no material regression against the same foundation/workspace. A provisional custom-feature overhead budget is 150 MB with the agent inactive; revise only with measured evidence. This is a target, not a result. Keep Docker and development-server resource use visible separately.

Token-efficiency choices: reuse provider sessions, send selected files/diffs/search results, cap command output, and avoid resending the repository. Provider quotas are shared with other uses of the account; no unlimited-usage assumption.

## 8. Next implementation gate

Proceed to the desktop foundation only after storage and toolchain readiness. Pin one upstream revision, record its exact prerequisites, build it unchanged, and demonstrate open/edit/save plus a working terminal. Then add custom panels and Codex. Claude's unified adapter and full extension migration remain conditional; they do not block the initial Codex-focused release.

This document completes planning task 1. It does not assert a successful build, installed extension compatibility, authenticated provider access, or measured performance.
