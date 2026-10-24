import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { composerAction } = require("../interface/src/codex-composer.cjs");
const ready = {
  connected: true,
  account: { type: "chatgpt" },
  mode: "ask",
  sandbox: "ready",
  busy: false,
  status: "Connected",
};

test("a disconnected composer offers connection instead of an unexplained disabled Send", () => {
  const action = composerAction({ ...ready, connected: false }, "my draft");
  assert.equal(action.type, "login");
  assert.equal(action.disabled, false);
  assert.match(action.hint, /draft/);
  assert.equal(
    composerAction(
      { ...ready, status: "Connecting", connected: false },
      "draft",
    ).disabled,
    true,
  );
});
test("subscription sign-in and sandbox readiness have actionable composer controls", () => {
  assert.equal(
    composerAction({ ...ready, account: null }, "draft").type,
    "login",
  );
  assert.equal(
    composerAction({ ...ready, account: { type: "apiKey" } }, "draft").type,
    "login",
  );
  assert.equal(
    composerAction({ ...ready, sandbox: "unknown" }, "draft").type,
    "setupSandbox",
  );
  assert.equal(
    composerAction({ ...ready, sandbox: "unknown", mode: "full" }, "draft")
      .type,
    "send",
  );
});
test("Send is available only for a ready nonempty draft and pending sends cannot repeat", () => {
  assert.equal(composerAction(ready, "hello").disabled, false);
  assert.equal(composerAction(ready, " ").disabled, true);
  assert.equal(composerAction(ready, "hello", true).disabled, true);
  assert.equal(
    composerAction({ ...ready, busy: true }, "hello", true).type,
    "stop",
  );
});
test("a rejected send reports failure to its draft instead of acknowledging acceptance", async () => {
  const hostFile = new URL("../interface/src/codex-host.cjs", import.meta.url);
  const localRequire = createRequire(hostFile),
    sent = [],
    disposables = [];
  const disposable = () => ({ dispose() {} });
  let provider;
  const panel = {
    webview: {
      postMessage: (message) => sent.push(message),
      asWebviewUri: (value) => String(value),
      onDidReceiveMessage: disposable,
    },
    onDidDispose: disposable,
    onDidChangeVisibility: disposable,
  };
  const vscode = {
    window: {
      activeTextEditor: null,
      registerWebviewViewProvider: (_id,value) => {provider=value;return disposable();},
      onDidChangeActiveTextEditor: disposable,
    },
    workspace: {
      registerTextDocumentContentProvider: disposable,
      onDidChangeTextDocument: disposable,
      onDidGrantWorkspaceTrust: disposable,
    },
    commands: { registerCommand: disposable, executeCommand: async()=>provider.resolveWebviewView(panel) },
    ViewColumn: { Beside: 2 },
    Uri: { joinPath: (base, ...parts) => path.join(base, ...parts) },
  };
  const sandbox = {
    module: { exports: {} },
    require: (name) => name === "./codex-inline-review.cjs" ? {registerInlineReview:()=>({clear(){},remove(){}})} : (name === "vscode" ? vscode : localRequire(name)),
    setTimeout,
    clearTimeout,
    Buffer,
    URL,
  };
  vm.runInNewContext(fs.readFileSync(hostFile, "utf8"), sandbox, {
    filename: hostFile.pathname,
  });
  const api = sandbox.module.exports.registerCodex({
    extensionUri: "interface",
    subscriptions: disposables,
    workspaceState: { get: () => null, update: async () => {} },
  });
  try {
    await api.show();
    await api.handle({ type: "send", id: "draft-1", text: "" });
    const result = sent.find((message) => message.type === "sendResult");
    assert.equal(result.id, "draft-1");
    assert.equal(result.accepted, false);
    assert.match(api.getState().error, /Enter a message/);
  } finally {
    for (const entry of disposables) entry.dispose();
  }
});
