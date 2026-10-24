import { context } from "esbuild";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
const backendPort = Number(process.env.PORT || 3001),
  frontPort = Number(process.env.FRONTEND_PORT || 5173);
const child = spawn(process.execPath, ["server/index.mjs"], {
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
fs.mkdirSync("dist", { recursive: true });
fs.copyFileSync("index.html", "dist/index.html");
const ctx = await context({
  entryPoints: ["client/main.tsx"],
  bundle: true,
  sourcemap: true,
  outdir: "dist/assets",
  entryNames: "app",
  jsx: "automatic",
});
await ctx.rebuild();
await ctx.watch();
const web = express();
web.use((req, res, next) => {
  if (!req.url.startsWith("/api/")) return next();
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: backendPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (reply) => {
      res.writeHead(reply.statusCode, reply.headers);
      reply.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent)
      res.status(502).json({ error: "Backend unavailable." });
    else res.end();
  });
  req.pipe(upstream);
});
web.use(express.static(path.resolve("dist")));
const server = web.listen(frontPort, "127.0.0.1", () =>
  console.log("Frontend http://127.0.0.1:" + server.address().port),
);
server.on("error", async (error) => {
  console.error(error.message);
  child.kill();
  await ctx.dispose();
  process.exitCode = 1;
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill();
  await ctx.dispose();
  server.close(() => process.exit(0));
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
child.on("exit", (code) => {
  if (!stopping) {
    console.error("Backend exited " + code);
    stop();
  }
});
