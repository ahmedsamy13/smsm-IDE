import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { applicationDataRoot } from "./foundation.mjs";
const require = createRequire(import.meta.url);
const { CodexRpc, resolveCodex } = require("../interface/src/codex-rpc.cjs");
const root = path.join(applicationDataRoot, "codex-verification");
fs.mkdirSync(root, { recursive: true });
const rpc = new CodexRpc({ executable: resolveCodex(), cwd: root });
rpc.on("request", (request) =>
  rpc.reject(request.id, "Probe does not approve tools"),
);
rpc.on("disconnected", () => {});
try {
  await rpc.start();
  const account = await rpc.request("account/read", { refreshToken: false });
  const sandbox = await rpc.request("windowsSandbox/readiness", {});
  const models = await rpc.request("model/list", { limit: 100 });
  console.log(
    JSON.stringify(
      {
        accountType: account.account?.type || null,
        plan: account.account?.planType || null,
        sandbox: sandbox.status,
        modelCount: models.data.length,
        model: models.data.find((m) => m.isDefault)?.model,
      },
      null,
      2,
    ),
  );
} finally {
  rpc.close();
}
