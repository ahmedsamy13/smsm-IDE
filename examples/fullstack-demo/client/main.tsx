import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Task = { id: string; title: string; done: boolean };

const MOCK_TASKS: Task[] = [
  { id: "mock-1", title: "Explore the fullstack demo", done: true },
  { id: "mock-2", title: "Add a new task", done: false },
  { id: "mock-3", title: "Connect the API", done: false },
];

const base =
  (window as Window & { PERSONAL_IDE_API_BASE?: string })
    .PERSONAL_IDE_API_BASE || "";

async function request(route: string, options: RequestInit = {}) {
  const response = await fetch(base + "/api" + route, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw Error(body.error || "Request failed");
  return body;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]),
    [title, setTitle] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);

  async function load() {
    try {
      setTasks((await request("/tasks")).tasks);
      setError("");
    } catch (error) {
      setTasks(MOCK_TASKS);
      setError(
        `Using sample tasks because the API is unavailable: ${String(error)}`,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await request("/tasks", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setTasks((current) => [...current, task]);
      setTitle("");
      setError("");
    } catch (error) {
      setError(String(error));
    }
  }

  async function toggle(task: Task) {
    try {
      const updated = await request("/tasks/" + task.id, {
        method: "PATCH",
        body: JSON.stringify({ done: !task.done }),
      });
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updated : item)),
      );
    } catch (error) {
      setError(String(error));
    }
  }

  return (
    <main>
      <p className="eyebrow">PERSONAL IDE - REAL FULLSTACK CHECK</p>
      <h1>
        A small project.
        <br />A complete workflow.
      </h1>
      <p className="intro">
        React + TypeScript in the browser. Express + Node.js behind the API.
        Your tasks stay on this machine.
      </p>
      <form onSubmit={add}>
        <label htmlFor="task">New task</label>
        <div className="row">
          <input
            id="task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="What will you build?"
          />
          <button disabled={!title.trim()}>Add task</button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading tasks.</p>
      ) : (
        <ul aria-label="Tasks">
          {tasks.map((task) => (
            <li key={task.id}>
              <label>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggle(task)}
                />
                <span className={task.done ? "done" : ""}>{task.title}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <footer>{tasks.length} tasks - Loopback API - No cloud database</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
