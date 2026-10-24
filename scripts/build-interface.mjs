import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("./build-interface.ps1", import.meta.url));
let result = spawnSync("pwsh.exe", ["-NoProfile", "-File", script], {
  stdio: "inherit",
  windowsHide: true,
});
if (result.error?.code === "ENOENT") {
  result = spawnSync("powershell.exe", ["-NoProfile", "-File", script], {
    stdio: "inherit",
    windowsHide: true,
  });
}
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
