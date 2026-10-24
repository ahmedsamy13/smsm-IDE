import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const app = createApp(
  process.env.DATA_FILE || path.join(root, ".data/tasks.json"),
);
app.use(express.static(path.join(root, "dist")));
const server = app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log("Backend listening " + server.address().port),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
