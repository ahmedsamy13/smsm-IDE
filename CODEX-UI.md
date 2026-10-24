# Codex sidebar — version 0.4.0

Click the Codex icon in the editor title actions or the labelled bottom-right status button. Ctrl+Alt+I also toggles the right sidebar. Hiding it keeps your draft and active conversation.

## Composer and navigation
Model, reasoning effort, and access controls remain at the bottom while the conversation scrolls. Enter sends; Shift+Enter adds a line. Text composition cannot accidentally send. The draft clears only after the host accepts it. While Codex works, Send becomes Stop and you can compose your next message.

Starter prompts only fill your draft. Copy controls work for messages and fenced code blocks. The Latest messages button returns to the newest response without forcing scrolling while you read older messages. Account and access details open in compact menus; Escape or clicking outside dismisses them.

## Edit review
Click a proposed filename or Changes → Review to open its native file diff in the editor. Each changed block has Accept / Reject actions, plus Accept all in file / Reject all in file at the top. Existing file editors also expose review actions.

Codex proposals apply immediately so the agent can complete a multi-file task without waiting for review after each file. Missing parent folders are created automatically. After the turn, use **Accept all changes** in chat to keep everything, **Reject all** to restore prior files and remove new files, or make individual decisions in the editor. Changes are checked against later manual edits before rollback. Pending reviews survive disconnects and restarts.

Unsaved buffers, stale disk content, invalid UTF-8, out-of-project paths, and symlink escapes prevent acceptance. Workspace trust, subscription sign-in, and command permissions remain enforced. Shell commands have separate access controls; file review is not a universal interception of command side effects.

The review uses the inherited native diff editor. Proposed content is shown there before being written to the working file; this is not an exact copy of Antigravity's private UI.

## Verification
30 unit checks passed, including partial acceptance, rejection, new/empty files, stale and unsaved content, line positions, CRLF/Unicode, and Enter/Shift+Enter/IME handling. Native desktop tests verify editor review CodeLens actions, partial acceptance, no-write rejection, sidebar/Console/toolbox regressions. Earlier live Codex tests reached the new approval flow successfully.

The optional local browser fixture uses the compiled React/Tailwind bundle with mock data; it does not connect an account or submit model requests. Final installer evidence is in release/verification.json.
