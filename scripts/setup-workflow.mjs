import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import {
  projectRoot,
  applicationDataRoot,
  requireRuntime,
  prepareProfile,
  cleanEnvironment,
} from "./foundation.mjs";
const require = createRequire(import.meta.url);
const { parseSettings } = require("../interface/extension/import-utils.cjs");
const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : applicationDataRoot;
const { userData, extensions } = prepareProfile(root);
const lock = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "workflow.lock.json"), "utf8"),
);
const cache = path.join(root, "extension-cache");
fs.mkdirSync(cache, { recursive: true });
const exe = requireRuntime();
const results = [];
for (const item of lock.extensions) {
  const base =
    "https://open-vsx.org/api/" +
    item.id.replace(".", "/") +
    "/" +
    item.version +
    "/file/" +
    item.id +
    "-" +
    item.version;
  const checksum = await fetch(base + ".sha256", {
    signal: AbortSignal.timeout(30000),
  });
  if (!checksum.ok) throw Error("Checksum unavailable for " + item.id);
  const expected = (await checksum.text())
    .match(/\b[a-f0-9]{64}\b/i)?.[0]
    ?.toLowerCase();
  if (!expected) throw Error("Invalid checksum for " + item.id);
  if (item.sha256 && item.sha256 !== expected)
    throw Error("Registry checksum changed for pinned " + item.id);
  const archive = path.join(cache, item.id + "-" + item.version + ".vsix");
  if (
    !fs.existsSync(archive) ||
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(archive))
      .digest("hex") !== expected
  ) {
    console.log("Downloading " + item.id + " " + item.version);
    const response = await fetch(base + ".vsix", {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw Error("Download failed for " + item.id);
    const data = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash("sha256").update(data).digest("hex") !== expected)
      throw Error("Checksum mismatch for " + item.id);
    fs.writeFileSync(archive, data);
  }
  await new Promise((resolve, reject) => {
    const child = spawn(
      exe,
      [
        path.join(path.dirname(exe), "resources", "app", "out", "cli.js"),
        "--user-data-dir",
        userData,
        "--extensions-dir",
        extensions,
        "--install-extension",
        archive,
        "--force",
      ],
      {
        env: { ...cleanEnvironment(), ELECTRON_RUN_AS_NODE: "1" },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error("Extension installer exited " + code)),
    );
  });
  results.push({ ...item, sha256: expected });
}
fs.writeFileSync(
  path.join(root, "workflow-extensions.json"),
  JSON.stringify(results, null, 2),
);
const settingsPath = path.join(userData, "User", "settings.json");
const settings = parseSettings(fs.readFileSync(settingsPath, "utf8"));
const defaults = {
  "eslint.workingDirectories": [{ mode: "auto" }],
  "npm.enableScriptExplorer": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
};
for (const language of [
  "javascript",
  "typescript",
  "javascriptreact",
  "typescriptreact",
  "json",
  "jsonc",
  "css",
  "scss",
  "html",
])
  defaults["[" + language + "]"] = {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
  };
let modified = false;
for (const [key, value] of Object.entries(defaults)) {
  if (!Object.hasOwn(settings, key)) {
    settings[key] = value;
    modified = true;
  }
}
if (modified) {
  fs.copyFileSync(
    settingsPath,
    settingsPath + ".before-workflow-" + Date.now() + ".bak",
  );
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
console.log("Fullstack extensions installed; existing settings preserved.");
