import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const dataDir = await mkdtemp(path.join(tmpdir(), "animal-farts-e2e-"));
const child = spawn(process.execPath, ["server/server.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: "5290",
    DB_PATH: path.join(dataDir, "e2e.db"),
    UPLOAD_DIR: path.join(dataDir, "uploads"),
    RATE_LIMIT_DISABLED: "1",
    SOCIAL_FEATURES_ENABLED: "0",
    NODE_ENV: "test",
  },
});

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill(signal);
  await rm(dataDir, { recursive: true, force: true });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await stop(signal);
    process.exit(0);
  });
}

child.on("exit", async (code, signal) => {
  await rm(dataDir, { recursive: true, force: true });
  if (!stopping) process.exitCode = code ?? (signal ? 1 : 0);
});
