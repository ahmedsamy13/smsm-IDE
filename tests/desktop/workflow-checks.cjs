const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await fn();
    if (result) return result;
    await delay(400);
  }
  throw Error("Timed out: " + label);
}
exports.run = async (root, evidence) => {
  const workspace = path.join(root, "workspace"),
    folder = vscode.workspace.workspaceFolders[0];
  const write = async (name, text) => {
    const uri = vscode.Uri.file(path.join(workspace, name));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(text));
    return vscode.workspace.openTextDocument(uri);
  };
  for (const [name, text, member] of [
    [
      "completion.ts",
      'const profile: {name: string} = {name:"Ada"};\nprofile.',
      "name",
    ],
    ["completion.js", 'const title = "hello";\ntitle.', "toUpperCase"],
  ]) {
    const document = await write(name, text);
    await vscode.window.showTextDocument(document);
    await until(async () => {
      const list = await vscode.commands.executeCommand(
        "vscode.executeCompletionItemProvider",
        document.uri,
        document.positionAt(text.length),
      );
      return list?.items.some(
        (x) =>
          (typeof x.label === "string" ? x.label : x.label.label) === member,
      );
    }, name + " completion");
  }
  evidence.checks.push("JS and TS completion returned expected members");
  const format = await write(
    "format.js",
    "const message='hello'\nconsole.log(message)\n",
  );
  await vscode.window.showTextDocument(format);
  const prettier = vscode.extensions.getExtension("esbenp.prettier-vscode");
  assert.ok(prettier);
  await prettier.activate();
  await vscode.commands.executeCommand("editor.action.formatDocument");
  await until(
    () => format.getText().includes('const message = "hello";'),
    "Prettier formatting",
  );
  await format.save();
  evidence.checks.push("Prettier formatted and saved JavaScript");
  const eslint = vscode.extensions.getExtension("dbaeumer.vscode-eslint");
  assert.ok(eslint);
  await eslint.activate();
  const lint = await write("lint.js", "const unused = 1;\n");
  await vscode.window.showTextDocument(lint);
  await until(
    () =>
      vscode.languages
        .getDiagnostics(lint.uri)
        .some((d) => d.source === "eslint" && d.message.includes("unused")),
    "ESLint diagnostic",
  );
  evidence.checks.push("ESLint reported the configured unused-variable error");
  const api = await vscode.extensions
    .getExtension("personal-ide.workspace-interface")
    .activate();
  const entries = await api.workflow.scripts();
  const entry = entries.find((e) => e.name === "start");
  assert.ok(entry);
  let taskSubscription, timer;
  const completed = new Promise((resolve, reject) => {
    taskSubscription = vscode.tasks.onDidEndTaskProcess((e) => {
      if (e.execution.task.name === "npm: start") resolve(e.exitCode);
    });
    timer = setTimeout(() => reject(Error("npm task timeout")), 45000);
  });
  try {
    await api.workflow.runScript(entry);
    assert.equal(await completed, 0);
  } finally {
    taskSubscription.dispose();
    clearTimeout(timer);
  }
  assert.equal(
    fs.readFileSync(path.join(workspace, "package-result.json"), "utf8"),
    "ok",
  );
  evidence.checks.push(
    "package script ran successfully through the task terminal",
  );
  const git = vscode.extensions.getExtension("vscode.git");
  assert.ok(git);
  await git.activate();
  const gitApi = git.exports.getAPI(1);
  await until(
    () =>
      gitApi.repositories.find(
        (r) => r.rootUri.fsPath.toLowerCase() === workspace.toLowerCase(),
      ),
    "Git repository detection",
  );
  evidence.checks.push("Git detected the disposable repository");
  const debug = await write(
    "debug.cjs",
    "let counter = 1;\ncounter += 2;\nconsole.log(counter);\n",
  );
  const bp = new vscode.SourceBreakpoint(
    new vscode.Location(debug.uri, new vscode.Position(1, 0)),
  );
  vscode.debug.addBreakpoints([bp]);
  let subscription, debugTimer, session;
  const stopped = new Promise((resolve, reject) => {
    subscription = vscode.debug.registerDebugAdapterTrackerFactory("*", {
      createDebugAdapterTracker(s) {
        session = s;
        console.log(
          "Tracking debugger session: " + s.name + " (" + s.type + ")",
        );
        return {
          onDidSendMessage(message) {
            if (message.type === "event" && message.event === "stopped") {
              console.log("Debugger stopped: " + JSON.stringify(message.body));
              resolve(message.body.reason);
            }
            if (
              message.type === "response" &&
              message.command === "setBreakpoints"
            )
              console.log(
                "Debugger breakpoints: " + JSON.stringify(message.body),
              );
          },
        };
      },
    });
    debugTimer = setTimeout(
      () => reject(Error("Debugger breakpoint timeout")),
      45000,
    );
  });
  try {
    assert.equal(
      await vscode.debug.startDebugging(folder, {
        type: "pwa-node",
        request: "launch",
        name: "Personal IDE breakpoint check",
        program: debug.uri.fsPath,
        runtimeExecutable: process.env.PERSONAL_IDE_SMOKE_NODE,
        console: "internalConsole",
        skipFiles: ["<node_internals>/**"],
      }),
      true,
    );
    assert.equal(await stopped, "breakpoint");
    evidence.checks.push("Node debugger stopped at a real source breakpoint");
  } finally {
    clearTimeout(debugTimer);
    subscription.dispose();
    vscode.debug.removeBreakpoints([bp]);
    if (session) await vscode.debug.stopDebugging(session);
  }
};
