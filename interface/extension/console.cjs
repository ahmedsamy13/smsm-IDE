// src/console-host.cjs
var vscode = require("vscode");
var fs = require("node:fs");
var path = require("node:path");
var crypto = require("node:crypto");
var { spawn } = require("node:child_process");
function registerConsole(context) {
  let view, child = null;
  const state = { running: false, file: "", exitCode: null, output: "", error: "" };
  function publish() {
    view?.webview.postMessage({ type: "consoleState", state });
  }
  function append(text) {
    state.output = (state.output + text).slice(-2e5);
    publish();
  }
  function show() {
    return vscode.commands.executeCommand("personalIde.consoleView.focus");
  }
  async function runFile(uri) {
    if (!vscode.workspace.isTrusted) throw Error("Trust the project before running code.");
    if (child) throw Error("Stop the running script first.");
    uri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!uri || uri.scheme !== "file" || ![".js", ".mjs", ".cjs"].includes(path.extname(uri.fsPath).toLowerCase())) throw Error("Open a JavaScript, MJS, or CJS file first.");
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (!folder) throw Error("Run a file inside the open project.");
    const document = await vscode.workspace.openTextDocument(uri);
    if (document.isDirty && !await document.save()) return;
    await show();
    state.file = path.basename(uri.fsPath);
    state.running = true;
    state.exitCode = null;
    state.output = "";
    state.error = "";
    publish();
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
    for (const key of Object.keys(env)) if (/^VSCODE_IPC_HOOK/i.test(key)) delete env[key];
    const command = spawn(process.execPath, ["--enable-source-maps", uri.fsPath], { cwd: folder.uri.fsPath, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child = command;
    return await new Promise((resolve) => {
      command.stdout.on("data", (buffer) => append(buffer.toString()));
      command.stderr.on("data", (buffer) => append(buffer.toString()));
      command.on("error", (error) => {
        state.error = error.message;
        publish();
      });
      command.on("close", (code) => {
        if (child === command) child = null;
        state.running = false;
        state.exitCode = code;
        publish();
        resolve(code);
      });
    });
  }
  const provider = { resolveWebviewView(resolved) {
    view = resolved;
    view.webview.options = { enableScripts: true, localResourceRoots: [context.extensionUri] };
    const nonce = crypto.randomBytes(24).toString("hex"), resource = (name) => view.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", name));
    view.webview.html = `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ` + view.webview.cspSource + "; script-src 'nonce-" + nonce + `';"><link rel="stylesheet" href="` + resource("panel.css") + '"></head><body><div id="root"></div><script nonce="' + nonce + '" src="' + resource("console.js") + '"></script></body></html>';
    view.webview.onDidReceiveMessage(async (message) => {
      try {
        if (message.type === "ready") publish();
        if (message.type === "run") await runFile();
        if (message.type === "stop") child?.kill();
        if (message.type === "clear") {
          state.output = "";
          state.error = "";
          publish();
        }
      } catch (error) {
        state.error = error.message;
        publish();
      }
    });
    view.onDidDispose(() => {
      view = null;
    });
  } };
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("personalIde.consoleView", provider), vscode.commands.registerCommand("personalIde.runJavaScript", () => runFile().catch((error) => vscode.window.showErrorMessage(error.message))), vscode.commands.registerCommand("personalIde.console", show), { dispose() {
    child?.kill();
  } });
  return { runFile, show, getState: () => state, stop: () => child?.kill() };
}
module.exports = { registerConsole };
