const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const semver = require("semver");
const { parseSettings, planSettings } = require("./import-plan.cjs");
const coreIds = [
  "esbenp.prettier-vscode",
  "dbaeumer.vscode-eslint",
  "bradlc.vscode-tailwindcss",
];
function trusted() {
  if (!vscode.workspace.isTrusted)
    throw Error(
      "Trust this workspace before running project scripts or debugging.",
    );
}
async function scripts() {
  const entries = [];
  for (const folder of vscode.workspace.workspaceFolders || []) {
    try {
      const manifest = JSON.parse(
        Buffer.from(
          await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(folder.uri, "package.json"),
          ),
        ).toString(),
      );
      for (const [name, command] of Object.entries(manifest.scripts || {}))
        if (typeof command === "string")
          entries.push({
            label: name,
            description: folder.name,
            detail: command,
            folder,
            name,
            manager: ["npm", "pnpm", "yarn", "bun"].includes(
              (manifest.packageManager || "").split("@")[0],
            )
              ? manifest.packageManager.split("@")[0]
              : fs.existsSync(path.join(folder.uri.fsPath, "pnpm-lock.yaml"))
                ? "pnpm"
                : fs.existsSync(path.join(folder.uri.fsPath, "yarn.lock"))
                  ? "yarn"
                  : fs.existsSync(path.join(folder.uri.fsPath, "bun.lock")) ||
                      fs.existsSync(path.join(folder.uri.fsPath, "bun.lockb"))
                    ? "bun"
                    : "npm",
          });
    } catch (error) {
      if (error.code !== "FileNotFound" && error.code !== "ENOENT")
        console.warn("Could not read project package.json: " + error.message);
    }
  }
  return entries;
}
function runScript(entry) {
  trusted();
  const task = new vscode.Task(
    { type: "personal-ide-script", script: entry.name },
    entry.folder,
    (entry.manager || "npm") + ": " + entry.name,
    "Personal IDE",
    new vscode.ShellExecution(
      entry.manager === "bun" ? "bun" : (entry.manager || "npm") + ".cmd",
      [
        { value: "run", quoting: vscode.ShellQuoting.Strong },
        { value: entry.name, quoting: vscode.ShellQuoting.Strong },
      ],
      { cwd: entry.folder.uri.fsPath },
    ),
  );
  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Dedicated,
  };
  return vscode.tasks.executeTask(task);
}
async function metadata(id) {
  if (!/^[\w-]+\.[\w-]+$/.test(id)) throw Error("Invalid extension identifier");
  const response = await fetch(
    "https://open-vsx.org/api/" + id.replace(".", "/") + "/latest",
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw Error("Not available from Open VSX");
  const m = await response.json();
  if ((m.namespace + "." + m.name).toLowerCase() !== id.toLowerCase())
    throw Error("Registry identifier mismatch");
  if (!semver.satisfies(vscode.version, m.engines?.vscode || "*"))
    throw Error("Requires editor " + m.engines?.vscode);
  if (
    m.targetPlatform &&
    !["universal", "win32-x64"].includes(m.targetPlatform)
  )
    throw Error("Unsupported target platform");
  if (
    !/^(MIT|Apache-2.0|BSD-2-Clause|BSD-3-Clause|ISC|MPL-2.0|EPL-2.0)$/.test(
      m.license || "",
    )
  )
    throw Error(
      "License requires manual review: " + (m.license || "unspecified"),
    );
  return m;
}
function registryURL(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "open-vsx.org")
    throw Error("Unexpected registry download URL");
  return value;
}
async function install(m, context) {
  const checksum = await fetch(registryURL(m.files.sha256), {
    signal: AbortSignal.timeout(30000),
  });
  if (!checksum.ok) throw Error("Could not obtain extension checksum");
  const expected = (await checksum.text())
    .match(/\b[a-f0-9]{64}\b/i)?.[0]
    ?.toLowerCase();
  if (!expected) throw Error("Invalid extension checksum");
  const response = await fetch(registryURL(m.files.download), {
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw Error("Could not download extension");
  const data = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash("sha256").update(data).digest("hex") !== expected)
    throw Error("Extension checksum mismatch");
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);
  const file = vscode.Uri.joinPath(
    context.globalStorageUri,
    m.namespace + "." + m.name + "-" + m.version + ".vsix",
  );
  await vscode.workspace.fs.writeFile(file, data);
  await vscode.commands.executeCommand(
    "workbench.extensions.installExtension",
    file,
  );
}
async function previewImport(context) {
  const sourceRoot = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    "Code",
    "User",
  );
  let settings = {};
  try {
    settings = parseSettings(
      fs.readFileSync(path.join(sourceRoot, "settings.json"), "utf8"),
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const current = {};
  for (const key of Object.keys(settings)) {
    const found = vscode.workspace.getConfiguration().inspect(key);
    if (found?.globalValue !== undefined) current[key] = found.globalValue;
  }
  const plan = planSettings(settings, current);
  const extensions = [],
    skipped = [];
  const local = path.join(os.homedir(), ".vscode", "extensions");
  const seen = new Set();
  if (fs.existsSync(local)) {
    for (const dir of fs.readdirSync(local, { withFileTypes: true })) {
      if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
      try {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(local, dir.name, "package.json"), "utf8"),
        );
        const id = manifest.publisher + "." + manifest.name;
        if (seen.has(id.toLowerCase())) continue;
        seen.add(id.toLowerCase());
        if (vscode.extensions.getExtension(id)) {
          skipped.push(id + ": already installed");
          continue;
        }
        try {
          const m = await metadata(id);
          extensions.push({ id, version: m.version, metadata: m });
        } catch (e) {
          skipped.push(id + ": " + e.message);
        }
      } catch {}
    }
  }
  const lines = [
    "# VS Code import preview",
    "",
    "Existing IDE values are preserved. Only supported editor settings are imported. Credential, executable-path, terminal-profile, and account settings are excluded. Keyboard shortcuts and account sessions are not imported.",
    "",
    "## Settings to add",
    ...plan.changes.map((x) => "- " + x.key + ": " + JSON.stringify(x.value)),
    "",
    "## Existing settings kept",
    ...plan.conflicts.map((x) => "- " + x),
    "",
    "## Excluded settings",
    ...plan.skipped.map((x) => "- " + x),
    "",
    "## Available extensions",
    ...extensions.map(
      (x) =>
        "- " +
        x.id +
        " " +
        x.version +
        " (Open VSX; " +
        x.metadata.license +
        ")",
    ),
    "",
    "## Skipped extensions",
    ...skipped.map((x) => "- " + x),
  ];
  const document = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });
  await vscode.window.showTextDocument(document);
  const selected = await vscode.window.showQuickPick(
    extensions.map((x) => ({
      label: x.id,
      description: x.version,
      picked: false,
      entry: x,
    })),
    {
      canPickMany: true,
      title: "Select extensions to import (none selected by default)",
      ignoreFocusOut: true,
    },
  );
  if (selected === undefined) return;
  const approval = await vscode.window.showInformationMessage(
    "Import " +
      plan.changes.length +
      " supported settings and " +
      selected.length +
      " selected extensions? Existing settings will be kept.",
    { modal: true },
    "Import reviewed items",
  );
  if (approval !== "Import reviewed items") return;
  const backup = {
    created: new Date().toISOString(),
    previous: Object.fromEntries(
      plan.changes.map((x) => [
        x.key,
        vscode.workspace.getConfiguration().inspect(x.key)?.globalValue ?? null,
      ]),
    ),
  };
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(context.globalStorageUri, "last-import-backup.json"),
    Buffer.from(JSON.stringify(backup, null, 2)),
  );
  const applied = [],
    failed = [];
  for (const change of plan.changes) {
    if (
      vscode.workspace.getConfiguration().inspect(change.key)?.globalValue !==
      undefined
    )
      continue;
    try {
      await vscode.workspace
        .getConfiguration()
        .update(change.key, change.value, vscode.ConfigurationTarget.Global);
      applied.push(change.key);
    } catch (e) {
      failed.push(change.key + ": " + e.message);
    }
  }
  for (const choice of selected) {
    try {
      await install(choice.entry.metadata, context);
      applied.push(choice.label);
    } catch (e) {
      failed.push(choice.label + ": " + e.message);
    }
  }
  const report = { applied, failed };
  await vscode.workspace.fs.writeFile(
    vscode.Uri.joinPath(context.globalStorageUri, "last-import-result.json"),
    Buffer.from(JSON.stringify(report, null, 2)),
  );
  vscode.window.showInformationMessage(
    "Import complete: " +
      applied.length +
      " applied, " +
      failed.length +
      " failed. Existing values were preserved.",
  );
  if (failed.length) {
    const doc = await vscode.workspace.openTextDocument({
      content: failed.join("\n"),
      language: "plaintext",
    });
    await vscode.window.showTextDocument(doc);
  }
}
exports.registerWorkflow = (context) => {
  const wrap = (fn) => async () => {
    try {
      return await fn();
    } catch (e) {
      vscode.window.showErrorMessage(e.message);
    }
  };
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "personalIde.scripts",
      wrap(async () => {
        trusted();
        const entries = await scripts();
        if (!entries.length) {
          vscode.window.showInformationMessage(
            "No root package.json scripts found in the open workspace folders.",
          );
          return;
        }
        const entry = await vscode.window.showQuickPick(entries, {
          title: "Run a package script",
        });
        if (entry) return runScript(entry);
      }),
    ),
    vscode.commands.registerCommand(
      "personalIde.debug",
      wrap(async () => {
        trusted();
        const choice = await vscode.window.showQuickPick(
          [
            {
              label: "Run and Debug configurations",
              command: "workbench.view.debug",
            },
            {
              label: "JavaScript Debug Terminal",
              description: "Run your Next, Nest, or Node dev script here",
              command: "extension.js-debug.createDebuggerTerminal",
            },
          ],
          { title: "Choose a debugging workflow" },
        );
        if (choice) await vscode.commands.executeCommand(choice.command);
      }),
    ),
    vscode.commands.registerCommand(
      "personalIde.import",
      wrap(() =>
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Reviewing compatible VS Code settings and extensions",
          },
          () => previewImport(context),
        ),
      ),
    ),
    vscode.commands.registerCommand(
      "personalIde.workflowDefaults",
      wrap(async () => {
        const values = {
          "[javascript]": {
            "editor.defaultFormatter": "esbenp.prettier-vscode",
          },
          "[typescript]": {
            "editor.defaultFormatter": "esbenp.prettier-vscode",
          },
          "[javascriptreact]": {
            "editor.defaultFormatter": "esbenp.prettier-vscode",
          },
          "[typescriptreact]": {
            "editor.defaultFormatter": "esbenp.prettier-vscode",
          },
          "eslint.workingDirectories": [{ mode: "auto" }],
          "npm.enableScriptExplorer": true,
        };
        for (const [key, value] of Object.entries(values)) {
          if (
            vscode.workspace.getConfiguration().inspect(key)?.globalValue ===
            undefined
          )
            await vscode.workspace
              .getConfiguration()
              .update(key, value, vscode.ConfigurationTarget.Global);
        }
        vscode.window.showInformationMessage(
          "Fullstack defaults applied. Existing settings and project configs were preserved.",
        );
      }),
    ),
  );
  return { scripts, runScript, parseSettings, planSettings };
};
