const readline = require("node:readline");
const write = (value) => process.stdout.write(JSON.stringify(value) + "\n");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const m = JSON.parse(line);
  if (m.method === "initialized") return;
  if (!m.method) {
    write({ method: "fixture/approval", params: m.result });
    return;
  }
  if (m.method === "initialize")
    return write({ id: m.id, result: { userAgent: "fixture" } });
  if (m.method === "ping") {
    const bytes = Buffer.from(
      JSON.stringify({ id: m.id, result: { text: "مرحبا" } }) + "\n",
    );
    process.stdout.write(bytes.subarray(0, bytes.length - 5));
    return setTimeout(
      () => process.stdout.write(bytes.subarray(bytes.length - 5)),
      5,
    );
  }
  if (m.method === "approval") {
    write({ id: m.id, result: { ok: true } });
    return write({
      id: "approval-1",
      method: "item/commandExecution/requestApproval",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        command: "node --version",
      },
    });
  }
  if (m.method === "hang") return;
  if (m.method === "die") return process.exit(1);
  if (m.method === "turn/start") {
    write({ id: m.id, result: { turn: { id: "turn-1" } } });
    write({
      method: "turn/started",
      params: { threadId: "thread-1", turn: { id: "turn-1" } },
    });
    return write({
      method: "item/agentMessage/delta",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        itemId: "message-1",
        delta: "partial",
      },
    });
  }
  if (m.method === "turn/interrupt") {
    write({ id: m.id, result: {} });
    return write({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turn: { id: "turn-1", status: "interrupted" },
      },
    });
  }
  write({
    id: m.id,
    error: { code: -32601, message: "unknown fixture method" },
  });
});
