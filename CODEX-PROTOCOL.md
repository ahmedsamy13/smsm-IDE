# Codex app-server client contract

Reference: [official app-server documentation](https://learn.chatgpt.com/docs/app-server). Client implemented and verified against the installed 0.160.1 generated TypeScript definitions.

## Transport and lifecycle

The native official codex.exe runs app-server --listen stdio:// with no shell. UTF-8 newline-delimited JSON carries integer client request IDs, responses, notifications, and server-initiated approval/input requests. This is not an HTTP API. The client initializes with experimentalApi:true (required for the client-defined proposal tool), then sends initialized. Outstanding requests time out and reject on child disconnect. Only the child spawned by this connection is closed.

## Methods used

| Methods | Purpose |
| --- | --- |
| initialize, initialized | Establish client protocol session |
| account/read | Read managed authentication state without refresh |
| account/login/start, account/login/cancel | ChatGPT browser sign-in and cancellation |
| model/list | Available models and supported reasoning efforts |
| windowsSandbox/readiness, windowsSandbox/setupStart | Restricted-mode readiness and explicit setup |
| config/read | Identify configured MCP server names for disabling in the thread |
| thread/start, thread/resume | Create/resume project conversation with policy overrides |
| turn/start, turn/interrupt | Send explicit context and sandbox policy; cancel active turn |

Thread creation/resume overrides cwd, model, approvalPolicy, approvalsReviewer:user, sandbox, disabled external tools, and developer instructions. Turn start supplies the concrete sandboxPolicy and current model/effort. The returned thread sandbox type is checked before sending a turn.

## Notifications consumed

account/login/completed, account/updated, windowsSandbox/setupCompleted, serverRequest/resolved, turn/started, turn/completed, turn/diff/updated, item/started, item/completed, item/agentMessage/delta, item/commandExecution/outputDelta, and error.

Scoped turn events must match the active thread and turn where supplied. Command/file items provide activity and proposed patches. Text is rendered as plain React text rather than executable markup.

## Server requests supported

- item/commandExecution/requestApproval → accept or decline, one request only; requires command or network preview before acceptance.
- item/fileChange/requestApproval → accept or decline; acceptance requires item patch changes.
- item/tool/requestUserInput → validated answers keyed by question ID.
- item/permissions/requestApproval → empty permissions, scope:turn (no grant).
- Unknown requests → JSON-RPC unsupported-method error.

Requests outside an active scoped turn are rejected. Disconnecting cancels pending requests; hiding the sidebar preserves its state. Session-wide approval decisions are not implemented.

## Authentication and failure behavior

The child forces the OpenAI provider and ChatGPT login method. Inherited OpenAI/Azure API keys and provider base URL are removed; non-ChatGPT auth cannot start a turn. Credentials stay managed by Codex, and child diagnostics are not copied into chat/history.

No compatibility adapter is silently selected. Missing executable, unsupported protocol, unavailable model, sandbox not ready, sign-in failure, timeout, and child disconnect surface as panel errors. Unknown permission/tool requests fail closed.


Client tool: thread/start registers personal_ide_propose_edit. Scoped item/tool/call requests prepare an in-memory diff; explicit approval applies a hash-checked file write and returns a tool response. Decline returns failure without writing. Only this allowlisted dynamic tool is accepted.
