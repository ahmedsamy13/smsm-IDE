import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  CodexRpc,
  access,
  environment,
  approvalResponse,
  forTurn,
} = require("../interface/src/codex-rpc.cjs");
const review = require("../interface/src/codex-review.cjs");
function fixture() {
  return new CodexRpc({
    spawn: () =>
      spawn(
        process.execPath,
        [path.resolve("tests/fixtures/codex-server.cjs")],
        { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
      ),
  });
}
test("actual stdio RPC handles chunked Unicode, server approvals, and request errors", async () => {
  const rpc = fixture();
  rpc.on("disconnected", () => {});
  try {
    await rpc.start();
    assert.equal((await rpc.request("ping")).text, "مرحبا");
    const request = once(rpc, "request");
    await rpc.request("approval");
    const [p] = await request;
    assert.equal(p.id, "approval-1");
    const notification = once(rpc, "notification");
    rpc.respond(p.id, { decision: "decline" });
    assert.equal((await notification)[0].params.decision, "decline");
    await assert.rejects(rpc.request("unknown"), /unknown fixture/);
  } finally {
    rpc.close();
  }
});
test("cancellation completes an active streamed turn as interrupted", async () => {
  const rpc = fixture();
  rpc.on("disconnected", () => {});
  try {
    await rpc.start();
    let streamed = "";
    rpc.on("notification", (m) => {
      if (m.method === "item/agentMessage/delta") streamed += m.params.delta;
    });
    await rpc.request("turn/start");
    const completion = new Promise((resolve) =>
      rpc.on("notification", (m) => {
        if (m.method === "turn/completed") resolve(m.params.turn.status);
      }),
    );
    await rpc.request("turn/interrupt");
    assert.equal(await completion, "interrupted");
    assert.equal(streamed, "partial");
  } finally {
    rpc.close();
  }
});
test("timeouts and crashed servers reject pending calls", async () => {
  const rpc = fixture();
  rpc.on("disconnected", () => {});
  try {
    await rpc.start();
    await assert.rejects(rpc.request("hang", {}, 20), /timed out/);
    assert.equal(rpc.pending.size, 0);
    await assert.rejects(rpc.request("die"), /disconnected/);
  } finally {
    rpc.close();
  }
});
test("access presets map to concrete sandbox and approval policies", () => {
  assert.deepEqual(access("ask", false, "C:/project").sandboxPolicy, {
    type: "readOnly",
    networkAccess: false,
  });
  const project = access("project", true, "C:/project");
  assert.equal(project.approvalPolicy, "on-request");
  assert.deepEqual(project.sandboxPolicy.writableRoots, ["C:/project"]);
  assert.equal(project.sandboxPolicy.excludeTmpdirEnvVar, true);
  assert.equal(access("full", false, "C:/project").approvalPolicy, "never");
  assert.throws(() => access("invalid", false, ""));
});
test("API keys and inherited Electron routing are excluded from child environment", () => {
  const env = environment({
    OPENAI_API_KEY: "not-a-real-secret",
    OPENAI_BASE_URL: "https://unwanted.invalid",
    ELECTRON_RUN_AS_NODE: "1",
    PATH: "tools",
  });
  assert.deepEqual(env, { PATH: "tools" });
});
test("approvals are scoped and require actionable previews; session-wide decisions rejected", () => {
  assert.equal(
    forTurn({ threadId: "other", turnId: "t" }, "thread", "t"),
    false,
  );
  assert.equal(
    forTurn({ threadId: "thread", turnId: "old" }, "thread", "t"),
    false,
  );
  assert.equal(
    forTurn({ threadId: "thread", turnId: "t" }, "thread", "t"),
    true,
  );
  assert.throws(
    () =>
      approvalResponse({ kind: "file", changes: [] }, { decision: "accept" }),
    /preview/,
  );
  assert.throws(
    () =>
      approvalResponse(
        { kind: "command", command: "node --version" },
        { decision: "acceptForSession" },
      ),
    /decision/,
  );
  assert.deepEqual(
    approvalResponse(
      { kind: "command", command: "node --version" },
      { decision: "accept" },
    ),
    { decision: "accept" },
  );
  assert.deepEqual(
    approvalResponse({ kind: "file", changes: [] }, { decision: "decline" }),
    { decision: "decline" },
  );
});
test("checkpoint detects edits and protects subsequent user changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-review-"));
  const file = path.join(root, "source.js");
  fs.writeFileSync(file, "before");
  const before = review.snapshot(root);
  fs.writeFileSync(file, "agent");
  const entry = review.changes(root, before).entries[0];
  assert.equal(entry.before.toString(), "before");
  fs.writeFileSync(file, "later user edit");
  assert.throws(() => review.restore(root, entry), /changed since review/);
  fs.writeFileSync(file, "agent");
  review.restore(root, entry);
  assert.equal(fs.readFileSync(file, "utf8"), "before");
});
test("concurrent user edits are excluded from automatic restore", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-user-edit-"));
  const file = path.join(root, "source.js");
  fs.writeFileSync(file, "before");
  const before = review.snapshot(root);
  fs.writeFileSync(file, "both");
  const entry = review.changes(root, before, new Set([review.key(file)]))
    .entries[0];
  assert.throws(() => review.restore(root, entry), /edited during the turn/);
  assert.equal(fs.readFileSync(file, "utf8"), "both");
});

test("path aliases use the same key for concurrent edit protection", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-path-alias-"));
  const target = path.join(root, "project");
  fs.mkdirSync(target);
  const file = path.join(target, "source.js");
  fs.writeFileSync(file, "before");
  const alias = path.join(root, "alias");
  fs.symlinkSync(
    target,
    alias,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(review.key(path.join(alias, "source.js")), review.key(file));
  assert.equal(review.within(target, path.join(alias, "source.js")), true);
  const before = review.snapshot(target);
  fs.writeFileSync(file, "both");
  const entry = review.changes(
    target,
    before,
    new Set([review.key(path.join(alias, "source.js"))]),
  ).entries[0];
  assert.equal(entry.userEdited, true);
});

test("omitted large files are not mistaken for newly added files during restore", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-large-file-"));
  const file = path.join(root, "large.txt");
  fs.writeFileSync(file, Buffer.alloc(1024 * 1024 + 1, 120));
  const before = review.snapshot(root);
  fs.writeFileSync(file, "smaller content");
  assert.equal(review.changes(root, before).entries.length, 0);
});
