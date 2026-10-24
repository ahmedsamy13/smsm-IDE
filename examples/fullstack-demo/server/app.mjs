import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export function createApp(dataFile) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  let tasks = fs.existsSync(dataFile)
    ? JSON.parse(fs.readFileSync(dataFile, "utf8"))
    : [];
  const save = () => {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(tasks, null, 2));
  };
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", service: "personal-ide-demo" }),
  );
  app.get("/api/tasks", (_req, res) => res.json({ tasks }));
  app.post("/api/tasks", (req, res) => {
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title || title.length > 120)
      return res
        .status(400)
        .json({ error: "Title must contain 1–120 characters." });
    const task = { id: crypto.randomUUID(), title, done: false };
    tasks.push(task);
    save();
    res.status(201).json(task);
  });
  app.patch("/api/tasks/:id", (req, res) => {
    const task = tasks.find((task) => task.id === req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found." });
    if (typeof req.body?.done !== "boolean")
      return res.status(400).json({ error: "done must be a boolean." });
    task.done = req.body.done;
    save();
    res.json(task);
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Route not found." }),
  );
  app.use((error, _req, res, _next) =>
    res
      .status(error.status === 400 ? 400 : 500)
      .json({
        error: error.status === 400 ? "Invalid JSON body." : "Request failed.",
      }),
  );
  return app;
}
