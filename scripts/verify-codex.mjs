import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { applicationDataRoot } from "./foundation.mjs";
const require = createRequire(import.meta.url);
const {
  CodexRpc,
  resolveCodex,
  access,
} = require("../interface/src/codex-rpc.cjs");
const review = require("../interface/src/codex-review.cjs");
const root = path.join(
  applicationDataRoot,
  "codex-verification",
  "live-" + Date.now(),
);
fs.mkdirSync(root, { recursive: true });
const marker = "PERSONAL_IDE_CODEX_WORKSPACE_OK";
fs.writeFileSync(path.join(root, "context.txt"), marker + "\n");
const before = review.snapshot(root);
const rpc = new CodexRpc({ executable: resolveCodex(), cwd: root });
const evidence = {
  root,
  checks: [],
  approvalsDeclined: 0,
  deltas: 0,
  commands: [],
};
let resolveTurn, rejectTurn;
const completed = new Promise((resolve, reject) => {
  resolveTurn = resolve;
  rejectTurn = reject;
});
rpc.on("disconnected", (e) => rejectTurn(e));
rpc.on("request", (request) => {
  evidence.approvalsDeclined++;
  if (
    /requestApproval$/.test(request.method) &&
    !request.method.includes("permissions")
  )
    rpc.respond(request.id, { decision: "decline" });
  else
    rpc.reject(
      request.id,
      "Live verification does not grant extra permissions",
    );
});
rpc.on("notification", (m) => {
  if (m.method === "item/agentMessage/delta") evidence.deltas++;
  if (
    m.method === "item/completed" &&
    m.params.item.type === "commandExecution"
  )
    evidence.commands.push({
      command: m.params.item.command,
      status: m.params.item.status,
    });
  if (m.method === "turn/completed") resolveTurn(m.params.turn);
});
const timeout = setTimeout(
  () => rejectTurn(Error("Live verification timed out after 180 seconds")),
  180000,
);
try {
  await rpc.start();
  const account = await rpc.request("account/read", { refreshToken: false });
  if (account.account?.type !== "chatgpt")
    throw Error("ChatGPT sign-in required; no inference was sent.");
  evidence.checks.push("Codex-managed ChatGPT subscription account detected");
  const sandbox = await rpc.request("windowsSandbox/readiness", {});
  if (sandbox.status !== "ready") throw Error("Windows sandbox is not ready");
  const models = await rpc.request("model/list", { limit: 100 }),
    model = models.data.find((m) => m.isDefault)?.model;
  const config = await rpc.request("config/read", {
    includeLayers: false,
    cwd: root,
  });
  const mcp = Object.fromEntries(
    Object.keys(config.config?.mcp_servers || {}).map((name) => [
      name,
      { enabled: false },
    ]),
  );
  const policy = access("project", false, root);
  const start = await rpc.request("thread/start", {
    cwd: root,
    model,
    ephemeral: true,
    sandbox: policy.sandbox,
    approvalPolicy: policy.approvalPolicy,
    approvalsReviewer: "user",
    config: {
      mcp_servers: mcp,
      features: {
        apps: false,
        plugins: false,
        hooks: false,
        multi_agent: false,
        browser_use: false,
        computer_use: false,
      },
      web_search: "disabled",
    },
    developerInstructions:
      "This is a disposable integration test. Work only within the given directory, do not use network or read outside it.",
  });
  if (start.sandbox.type !== "workspaceWrite")
    throw Error("Server did not honor workspace-write sandbox");
  evidence.checks.push("Server honored project-write sandbox");
  await rpc.request("turn/start", {
    threadId: start.thread.id,
    cwd: root,
    model,
    effort: "low",
    approvalPolicy: policy.approvalPolicy,
    approvalsReviewer: "user",
    sandboxPolicy: policy.sandboxPolicy,
    input: [
      {
        type: "text",
        text: "Read context.txt in this directory. Create result.txt containing exactly its marker (a final newline is fine). Run node --version using a command. Then reply briefly with the marker. Do not request additional permissions, access other directories, or use the network.",
        text_elements: [],
      },
    ],
  });
  const turn = await completed;
  if (turn.status !== "completed")
    throw Error(turn.error?.message || "Turn status: " + turn.status);
  if (!evidence.deltas) throw Error("No assistant streaming deltas observed");
  evidence.checks.push("Live assistant streaming completed");
  if (fs.readFileSync(path.join(root, "result.txt"), "utf8").trim() !== marker)
    throw Error("Expected edit not observed");
  evidence.checks.push(
    "Live agent read project context and wrote the expected file",
  );
  if (
    !evidence.commands.some(
      (c) => c.status === "completed" && /node.*--version/i.test(c.command),
    )
  )
    throw Error("Expected completed Node command not observed");
  evidence.checks.push("Live agent executed Node version command successfully");
  if (
    !review.changes(root, before).entries.some((e) => e.label === "result.txt")
  )
    throw Error("Review checkpoint did not detect agent edit");
  evidence.checks.push("Local review checkpoint captured the agent change");
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.error = error.message;
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  rpc.close();
  fs.writeFileSync(
    path.join(root, "result.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
}
