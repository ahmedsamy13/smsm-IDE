const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const { StringDecoder } = require("node:string_decoder");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
function resolveCodex(configured, bundled) {
  const candidates = configured
    ? [configured]
    : [
        bundled,
        path.resolve(__dirname,"../../.runtime/codex-0.160.1/bin/codex.exe"),
        path.join(
          process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
          "npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe",
        ),
        ...(process.env.PATH || "")
          .split(path.delimiter)
          .filter(Boolean)
          .map((dir) => path.join(dir, "codex.exe")),
      ];
  const found = candidates.find(
    (file) =>
      typeof file === "string" && path.isAbsolute(file) &&
      fs.existsSync(file) &&
      fs.statSync(file).isFile() &&
      file.toLowerCase().endsWith(".exe"),
  );
  if (!found)
    throw Error(
      "Codex executable not found. Install the official Codex CLI or set Personal IDE: Codex Executable.",
    );
  return found;
}
function environment(source = process.env) {
  const env = { ...source };
  for (const key of Object.keys(env))
    if (
      /^(OPENAI_API_KEY|OPENAI_BASE_URL|AZURE_OPENAI_API_KEY|ELECTRON_RUN_AS_NODE|VSCODE_IPC_HOOK.*)$/i.test(
        key,
      )
    )
      delete env[key];
  return env;
}
function access(mode, network, root, commandApprovals = true) {
  if (!["ask", "project", "full"].includes(mode))
    throw Error("Invalid access mode");
  const approvalPolicy =
    !commandApprovals ? "never" : mode === "ask" ? "untrusted" : mode === "project" ? "on-request" : "never";
  const sandbox =
    mode === "ask"
      ? "read-only"
      : mode === "project"
        ? "workspace-write"
        : "danger-full-access";
  const sandboxPolicy =
    mode === "ask"
      ? { type: "readOnly", networkAccess: !!network }
      : mode === "project"
        ? {
            type: "workspaceWrite",
            writableRoots: [root],
            networkAccess: !!network,
            excludeTmpdirEnvVar: true,
            excludeSlashTmp: true,
          }
        : { type: "dangerFullAccess" };
  return { approvalPolicy, approvalsReviewer: "user", sandbox, sandboxPolicy };
}
class CodexRpc extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.sequence = 0;
    this.pending = new Map();
    this.decoder = new StringDecoder("utf8");
    this.buffer = "";
    this.child = null;
    this.closed = false;
  }
  async start() {
    if (this.child) return;
    const args = [
      "app-server",
      "--listen",
      "stdio://",
      "-c",
      'model_provider="openai"',
      "-c",
      'forced_login_method="chatgpt"',
      "-c",
      'web_search="disabled"',
    ];
    for (const feature of [
      "apps",
      "plugins",
      "hooks",
      "multi_agent",
      "browser_use",
      "computer_use",
      "in_app_browser",
    ])
      args.push("--disable", feature);
    this.child = (this.options.spawn || spawn)(
      this.options.executable || resolveCodex(),
      args,
      {
        cwd: this.options.cwd,
        env: environment(this.options.env),
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    this.child.stdout.on("data", (data) =>
      this.receive(this.decoder.write(data)),
    );
    this.child.stderr.on("data", () => {}); // Provider diagnostics are not copied into chat/history.
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", () =>
      this.fail(
        Error("Codex disconnected. Reconnect before sending another message."),
      ),
    );
    await this.request("initialize", {
      clientInfo: {
        name: "personal_ide",
        title: "Personal IDE",
        version: "0.5.0",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
        explicitGatewayOauth: true,
      },
    });
    this.notify("initialized", {});
  }
  receive(chunk) {
    this.buffer += chunk;
    if (this.buffer.length > 16 * 1024 * 1024) {
      this.fail(Error("Codex protocol message exceeded the client limit"));
      this.close();
      return;
    }
    let at;
    while ((at = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, at);
      this.buffer = this.buffer.slice(at + 1);
      if (!line.trim()) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.fail(Error("Invalid Codex protocol response"));
        this.close();
        return;
      }
      if (message.method) {
        this.emit(
          Object.hasOwn(message, "id") ? "request" : "notification",
          message,
        );
        continue;
      }
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error)
        pending.reject(Error(message.error.message || "Codex request failed"));
      else pending.resolve(message.result);
    }
  }
  write(message) {
    if (!this.child || this.closed || this.child.stdin.destroyed)
      throw Error("Codex is disconnected");
    this.child.stdin.write(JSON.stringify(message) + "\n");
  }
  request(method, params = {}, timeout = 90000) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Error("Codex request timed out: " + method));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.write({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  notify(method, params) {
    this.write({ method, params });
  }
  respond(id, result) {
    this.write({ id, result });
  }
  reject(id, message = "Unsupported client request") {
    this.write({ id, error: { code: -32601, message } });
  }
  fail(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    if (!this.closed) this.emit("disconnected", error);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail(Error("Codex connection closed"));
    if (this.child) {
      const child = this.child;
      child.stdin.end();
      const timer = setTimeout(() => {
        if (child.exitCode === null) child.kill();
      }, 2000);
      timer.unref();
    }
    this.child = null;
  }
}
module.exports = { CodexRpc, resolveCodex, environment, access };

function forTurn(params, threadId, turnId) {
  return (
    params.threadId === threadId &&
    (!turnId || !params.turnId || params.turnId === turnId)
  );
}
function approvalResponse(view, action) {
  if (view.kind === "question") {
    const answers = {};
    for (const question of view.questions) {
      const value = action.answers?.[question.id];
      if (typeof value !== "string" || value.length > 8000)
        throw Error("Provide a valid answer for each question");
      answers[question.id] = { answers: [value] };
    }
    return { answers };
  }
  if (!["file", "command"].includes(view.kind))
    throw Error("Unsupported approval kind");
  if (!["accept", "decline"].includes(action.decision))
    throw Error("Invalid approval decision");
  if (
    action.decision === "accept" &&
    view.kind === "file" &&
    !view.changes?.length
  )
    throw Error(
      "No patch preview was supplied. Decline and ask Codex to show the change.",
    );
  if (
    action.decision === "accept" &&
    view.kind === "command" &&
    !view.command &&
    !view.network
  )
    throw Error("No actionable command or network preview was supplied.");
  return { decision: action.decision };
}
module.exports.forTurn = forTurn;
module.exports.approvalResponse = approvalResponse;
