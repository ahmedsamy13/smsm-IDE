import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const outputRoot = process.env.PERSONAL_IDE_BUILD_OUTPUT || "extension";
const output = (name) => outputRoot + "/" + name;
fs.mkdirSync(output("dist"), { recursive: true });
// Keep output writes in Node rather than the native compiler process.
async function bundle(options) {
  const result = await build({ ...options, write: false });
  for (const output of result.outputFiles)
    fs.writeFileSync(output.path, output.contents);
}
await bundle({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  outfile: output("dist/panel.js"),
  define: { "process.env.NODE_ENV": '"production"' },
});
execFileSync(
  process.execPath,
  [
    "node_modules/@tailwindcss/cli/dist/index.mjs",
    "-i",
    "src/style.css",
    "-o",
    output("dist/panel.css"),
    "--minify",
  ],
  { stdio: "inherit" },
);
await bundle({
  entryPoints: ["src/workflow-source.cjs"],
  bundle: true,
  platform: "node",
  mainFields: ["module", "main"],
  format: "cjs",
  external: ["vscode"],
  outfile: output("workflow.cjs"),
});
await bundle({
  entryPoints: ["src/import-plan.cjs"],
  bundle: true,
  platform: "node",
  mainFields: ["module", "main"],
  format: "cjs",
  outfile: output("import-utils.cjs"),
});

await bundle({
  entryPoints: ["src/codex-main.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  outfile: output("dist/codex.js"),
  define: { "process.env.NODE_ENV": '"production"' },
});
await bundle({entryPoints:["src/console-main.jsx"],bundle:true,minify:true,format:"iife",outfile:output("dist/console.js"),define:{"process.env.NODE_ENV":'"production"'}});
await bundle({entryPoints:["src/console-host.cjs"],bundle:true,platform:"node",format:"cjs",external:["vscode"],outfile:output("console.cjs")});
await bundle({
  entryPoints: ["src/codex-host.cjs"],
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["vscode"],
  outfile: output("codex.cjs"),
});

await bundle({entryPoints:["src/toolbox-host.cjs"],bundle:true,platform:"node",format:"cjs",external:["vscode"],outfile:output("toolbox.cjs")});
