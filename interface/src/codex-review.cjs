const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ignored = new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "coverage",
  ".runtime",
  ".verification",
  ".local",
]);
function canonical(file) {
  try {
    return fs.realpathSync(file);
  } catch {
    try {
      return path.join(
        fs.realpathSync(path.dirname(file)),
        path.basename(file),
      );
    } catch {
      return path.resolve(file);
    }
  }
}
const key = (file) =>
  process.platform === "win32"
    ? canonical(file).toLowerCase()
    : canonical(file);
const hash = (data) =>
  data === null ? null : crypto.createHash("sha256").update(data).digest("hex");
function within(root, file) {
  const relative = path.relative(canonical(root), canonical(file));
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
function readText(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024)
      return null;
    const data = fs.readFileSync(file);
    if (data.includes(0)) return null;
    return data;
  } catch {
    return null;
  }
}
function snapshot(root) {
  const files = new Map(),
    omitted = new Set(),
    omittedDirectories = [];
  let bytes = 0,
    skipped = 0;
  function walk(dir) {
    let children;
    try {
      children = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      omittedDirectories.push(dir);
      skipped++;
      return;
    }
    for (const entry of children) {
      if (ignored.has(entry.name)) continue;
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        omitted.add(file);
        skipped++;
        continue;
      }
      if (entry.isDirectory()) {
        if (files.size < 2000 && bytes < 20 * 1024 * 1024) walk(file);
        else {
          omittedDirectories.push(file);
          skipped++;
        }
        continue;
      }
      if (files.size >= 2000 || bytes >= 20 * 1024 * 1024) {
        omitted.add(file);
        skipped++;
        continue;
      }
      const data = readText(file);
      if (data !== null && bytes + data.length <= 20 * 1024 * 1024) {
        files.set(file, data);
        bytes += data.length;
      } else {
        omitted.add(file);
        skipped++;
      }
    }
  }
  walk(root);
  return { files, omitted, omittedDirectories, skipped };
}
function excluded(snapshot, file) {
  return (
    snapshot.omitted?.has(file) ||
    (snapshot.omittedDirectories || []).some((dir) => within(dir, file))
  );
}
function changes(root, before, userEdits = new Set()) {
  const after = snapshot(root),
    result = [];
  for (const file of new Set([...before.files.keys(), ...after.files.keys()])) {
    if (excluded(before, file) || excluded(after, file)) continue;
    const old = before.files.get(file) ?? null,
      now = after.files.get(file) ?? null;
    if (hash(old) === hash(now)) continue;
    result.push({
      id: crypto.randomUUID(),
      file,
      label: path.relative(root, file),
      before: old,
      after: now,
      afterHash: hash(now),
      userEdited: userEdits.has(key(file)),
    });
  }
  return { entries: result, skipped: before.skipped + after.skipped };
}
function restore(root, entry) {
  if (!within(root, entry.file))
    throw Error("Review path is outside the selected workspace");
  if (entry.userEdited)
    throw Error(
      "This file was edited during the turn. Restore it manually to preserve your work.",
    );
  let current = null;
  if (fs.existsSync(entry.file)) {
    const real = fs.realpathSync(entry.file);
    if (!within(root, real))
      throw Error("Review path resolves outside the workspace");
    current = readText(entry.file);
    if (current === null) throw Error("Current file cannot be safely restored");
  }
  if (hash(current) !== entry.afterHash)
    throw Error(
      "The file changed since review. Restore it manually to preserve those edits.",
    );
  const parent = fs.realpathSync(path.dirname(entry.file));
  if (!within(root, parent))
    throw Error("Review parent resolves outside the workspace");
  if (entry.before === null) {
    if (current !== null) fs.unlinkSync(entry.file);
  } else fs.writeFileSync(entry.file, entry.before);
}
module.exports = { snapshot, changes, restore, hash, within, key };
