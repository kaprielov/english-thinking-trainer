import { spawn } from "node:child_process";
import process from "node:process";

const api = spawn(process.execPath, ["scripts/api-server.mjs"], {
  stdio: "inherit",
  env: process.env,
});

const client = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
  stdio: "inherit",
  env: process.env,
});

function shutdown(signal) {
  api.kill(signal);
  client.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

api.on("exit", (code) => {
  client.kill("SIGTERM");
  process.exit(code ?? 0);
});

client.on("exit", (code) => {
  api.kill("SIGTERM");
  process.exit(code ?? 0);
});
