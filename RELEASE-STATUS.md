# Personal IDE 0.6.1 Codex-only source

Google integration and its bundled runtime were removed. Codex is the sole agent provider. The source suite has 38 passing checks.

The valid verified installer remains version 0.6.0. Build and verify a new installer before distributing this source revision.

# Personal IDE 0.5.0 release verification

Built for personal use on Windows 11, Intel i5-10500H, approximately 8 GB RAM.

## Verified
- 24 unit checks for foundation/import, Codex transport, composer, review, permissions, and proposed edits.
- Native desktop launch, theme/React view activation, real editor saves, and terminal PTY.
- Right Codex sidebar toggle, live ChatGPT subscription connection and streaming, file approval and decline.
- JavaScript Console stdout/stderr, failure exit and Stop.
- SQLite create/query and native schema browser after a compatibility repair.
- REST Client request against a real local endpoint and rendered response.
- Container extension availability and missing-engine guidance; SSH extension/client readiness.
- Real React/TypeScript + Express demo, TypeScript completion, Prettier, Git/scripts, ESLint diagnostics, Node breakpoint, and seven Postman assertions through the frontend proxy. Browser create/complete flow verified in a prior successful run of the unchanged demo.

Fullstack evidence: %LOCALAPPDATA%/PersonalIDE/release-verification/2026-10-23T19-16-52-628Z/result.json.
Toolbox evidence: %LOCALAPPDATA%/PersonalIDE/verification/2026-10-23T20-00-14-903Z/result.json.
Live proposal evidence: %LOCALAPPDATA%/PersonalIDE/verification/2026-10-23T19-54-28-505Z/result.json.

## Resource measurements
A preliminary fullstack session measured about 2.0 GB summed process working set and 1.1 GB private memory for the IDE, plus about 166 MB working set for the running demo. Average CPU was approximately 1–2% normalized across 12 logical CPUs. Shared pages may be counted more than once in working-set totals, startup was included in the short idle sample, and the older CPU sampler rounded some deltas. Treat these as indicative measurements, not performance guarantees. The full final toolbox/Codex combination has not received a new controlled benchmark.

## Delivery
The per-user x64 installer bundles the runtime, interface, SQLite executable, and eight checksum-verified compatible extensions. Opening the IDE needs no separate Node installation. Project dependencies and AI sign-in require their usual setup.

Installer results are recorded separately in release/verification.json after install/launch/uninstall checks. SHA256 accompanies the installer.

## Remaining external prerequisites
Docker engine/WSL are absent; no live container run is claimed. No remote host was supplied, so no live SSH session is claimed. Guided setup and compatible clients are provided. Claude/Gemini provider integrations remain outside this milestone. Application code signing is not configured; the installer is unsigned. Upstream runtime/icon branding remains.

![Verified React and Express demo](.verification/fullstack-browser.png)
