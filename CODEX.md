# Browser sign-in and account usage — 0.5.0

## Fresh Windows installation
Install Personal IDE, open its Codex sidebar, and click Sign in with ChatGPT. The official browser sign-in opens; finish it in your browser, then return to the IDE. The bundled official Windows engine manages OAuth credentials and renewal. No separate Codex CLI installation, terminal login command, API key, or Codex desktop app is required.

An existing valid sign-in is reused. Sign-in can happen before opening or trusting a project; agent work still requires an opened, trusted workspace. Disconnect closes only this IDE's engine process and leaves the shared official account sign-in intact. Cancel stops a pending browser sign-in.

This personal local client uses official app-server managed browser OAuth; it does not register or impersonate a separate third-party OAuth client, collect your password, or copy your authentication file. A custom registered Sign in with ChatGPT provider would be a separate integration.

## Usage bar
The sidebar footer shows the account's remaining allowance for the windows supplied by the service, such as 5h and 7d. These are quota percentages, not a token balance, and are shared across Codex clients. Open Usage details for reset times, other returned buckets, last refresh time, and manual refresh.

Readings refresh on connection, sign-in, rate-limit notifications, and completed turns. Refreshes are coalesced; there is no continuous polling loop. Unavailable fields are never shown as zero usage. A failed refresh retains the last successful reading and marks it in details. The service's usage-blocked state is respected independently of percentages. No credits are purchased or resets consumed.

## Model and access
Models and reasoning options come from the engine. Available account access remains controlled by the provider. The native file-review, command approval, sandbox, network, and workspace trust controls described in CODEX-UI.md remain in effect.

The bundled engine is official Codex 0.160.1 Windows x64 with its helper executables, Apache-2.0 license, and bundled third-party notices. A custom executable can still be selected in Personal IDE: Codex Executable. Runtime provenance and file hashes are in .runtime/codex-0.160.1/personal-ide-engine.json.

## Verification
35 unit tests passed. A real account read returned quota windows. A separate signed-out profile started and cancelled official browser OAuth without changing the existing sign-in. Host-level tests cover login before workspace trust, duplicate attempts, invalid provider URLs, and unavailable usage data. Completing a fresh browser login is a user action and was not automated.

Protocol: https://learn.chatgpt.com/docs/app-server
