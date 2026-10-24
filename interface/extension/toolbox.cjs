// src/toolbox-host.cjs
var vscode = require("vscode");
var path = require("node:path");
var fs = require("node:fs");
var { execFile } = require("node:child_process");
function command(exe, args) {
  return new Promise((resolve) => execFile(exe, args, { windowsHide: true, timeout: 12e3, maxBuffer: 256 * 1024 }, (error, stdout, stderr) => resolve({ ok: !error, text: String(stdout || stderr || error?.message || "").slice(0, 8e3) })));
}
function registerToolbox(context) {
  const sqlite = path.join(context.extensionPath, "tools", "sqlite3.exe");
  const emitter = new vscode.EventEmitter();
  let status = { docker: "Check engine", database: "SQLite ready", api: "REST requests", remote: "SSH ready" };
  const items = () => [
    { label: "Docker / Containers", description: status.docker, icon: "package", command: "personalIde.docker" },
    { label: "Databases", description: status.database, icon: "database", command: "personalIde.database" },
    { label: "API requests", description: status.api, icon: "globe", command: "personalIde.api" },
    { label: "Remote development", description: status.remote, icon: "remote", command: "personalIde.remote" }
  ];
  const provider = { onDidChangeTreeData: emitter.event, getChildren: () => items(), getTreeItem: (item) => {
    const tree = new vscode.TreeItem(item.label);
    tree.description = item.description;
    tree.iconPath = new vscode.ThemeIcon(item.icon);
    tree.command = { command: item.command, title: item.label };
    return tree;
  } };
  async function docker() {
    if (!vscode.workspace.isTrusted) throw Error("Trust the project before using containers.");
    const result = await command("docker", ["info", "--format", "{{.ServerVersion}}"]);
    status.docker = result.ok ? "Engine " + result.text.trim() : "Setup needed";
    emitter.fire();
    if (result.ok) {
      await vscode.commands.executeCommand("workbench.view.extension.containersView");
      return result;
    }
    const selection = await vscode.window.showInformationMessage("Docker needs a running Docker engine. Docker Desktop's setup can add its Linux backend; it may need a Windows restart.", "Open Docker setup", "Container tools");
    if (selection === "Open Docker setup") await vscode.env.openExternal(vscode.Uri.parse("https://docs.docker.com/desktop/setup/install/windows-install/"));
    if (selection === "Container tools") await vscode.commands.executeCommand("workbench.view.extension.containersView");
    return result;
  }
  async function database(uri) {
    if (!uri) {
      const choice = await vscode.window.showQuickPick([{ label: "Open SQLite database", action: "open" }, { label: "Create and open sample database", action: "sample" }], { title: "Browse a database" });
      if (!choice) return;
      if (choice.action === "sample") {
        const dir = context.globalStorageUri.fsPath;
        fs.mkdirSync(dir, { recursive: true });
        uri = vscode.Uri.file(path.join(dir, "sample.sqlite"));
        const result = await command(sqlite, [uri.fsPath, "CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY,title TEXT,done INTEGER); INSERT OR IGNORE INTO tasks VALUES(1,'Build my fullstack project',0),(2,'Review Codex edits',1);"]);
        if (!result.ok) throw Error(result.text);
      } else uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { "SQLite databases": ["sqlite", "sqlite3", "db"] } }))?.[0];
    }
    if (!uri) return;
    await vscode.commands.executeCommand("sqlite.explorer.add", uri);
    return uri;
  }
  async function api() {
    const document = await vscode.workspace.openTextDocument({ language: "http", content: '### Local API health\nGET http://127.0.0.1:3001/api/health\nAccept: application/json\n\n### Create a task\nPOST http://127.0.0.1:3001/api/tasks\nContent-Type: application/json\n\n{ "title": "My new task" }\n' });
    await vscode.window.showTextDocument(document);
  }
  async function remote() {
    const choice = await vscode.window.showQuickPick([{ label: "Keep working on this computer", action: "local", description: "Recommended until you have a remote machine" }, { label: "Connect to another computer", action: "ssh", description: "Requires its SSH host name and username" }], { title: "Where do you want to develop?" });
    if (choice?.action === "ssh") await vscode.commands.executeCommand("openremotessh.openEmptyWindow");
  }
  const wrap = (fn) => (...args) => Promise.resolve(fn(...args)).catch((error) => vscode.window.showErrorMessage(error.message));
  context.subscriptions.push(emitter, vscode.window.registerTreeDataProvider("personalIde.toolbox", provider), vscode.commands.registerCommand("personalIde.docker", wrap(docker)), vscode.commands.registerCommand("personalIde.database", wrap(database)), vscode.commands.registerCommand("personalIde.api", wrap(api)), vscode.commands.registerCommand("personalIde.remote", wrap(remote)));
  return { database, api, checkDocker: () => command("docker", ["info", "--format", "{{.ServerVersion}}"]), checkSSH: () => command("C:\\Windows\\System32\\OpenSSH\\ssh.exe", ["-V"]), query: (file, sql) => command(sqlite, ["-json", file, sql]) };
}
module.exports = { registerToolbox };
