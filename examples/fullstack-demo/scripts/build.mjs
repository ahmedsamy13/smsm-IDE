import { build } from "esbuild";
import fs from "node:fs";
fs.mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["client/main.tsx"],
  bundle: true,
  minify: true,
  sourcemap: true,
  outdir: "dist/assets",
  entryNames: "app",
  jsx: "automatic",
});
fs.copyFileSync("index.html", "dist/index.html");
console.log("Frontend production build ready.");
