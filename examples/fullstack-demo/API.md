# Task API contract

All routes use /api, JSON, and a loopback-only listener. This is a local demo with no authentication or remote dependencies.

- GET /api/health → 200 {status:"ok",service:"personal-ide-demo"}.
- GET /api/tasks → 200 {tasks:Task[]}.
- POST /api/tasks, body {title:string} → 201 Task. Trimmed title must contain 1–120 characters; otherwise 400 {error:string}.
- PATCH /api/tasks/:id, body {done:boolean} → 200 Task. Unknown ID → 404; nonboolean done → 400.
- Unknown /api routes → 404 {error:string}; malformed JSON → 400.
- Task = {id:string,title:string,done:boolean}. Tasks persist to DATA_FILE (default .data/tasks.json).

The collection in postman/ is executable against the real backend. The local simulation provides the same contract for separate frontend dependency checks; it is not evidence that the real backend works.
