import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  parseSettings,
  planSettings,
} = require("../interface/extension/import-utils.cjs");
test("JSONC import preserves existing values and excludes executable and credential settings", () => {
  const source = parseSettings(
    '{// VS Code settings\n"editor.tabSize":2,"editor.fontSize":15,"terminal.integrated.env.windows":{"TOKEN":"secret"},"typescript.tsdk":"untrusted-path","some.apiKey":"secret",}',
  );
  const plan = planSettings(source, { "editor.tabSize": 4 });
  assert.deepEqual(plan.changes, [{ key: "editor.fontSize", value: 15 }]);
  assert.deepEqual(plan.conflicts, ["editor.tabSize"]);
  assert.equal(JSON.stringify(plan.changes).includes("secret"), false);
});
test("language blocks filter unsupported executable settings", () => {
  const plan = planSettings(
    { "[typescript]": { "editor.tabSize": 2, "some.apiKey": "secret" } },
    {},
  );
  assert.deepEqual(plan.changes, [
    { key: "[typescript]", value: { "editor.tabSize": 2 } },
  ]);
});
test("malformed source is rejected instead of partially imported", () =>
  assert.throws(
    () => parseSettings('{"editor.tabSize":}'),
    /Invalid settings/,
  ));
