import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const clientPort = portIndex >= 0 ? args[portIndex + 1] : "4173";
if (!/^\d+$/.test(clientPort || "")) {
  throw new Error("--port 必须是有效端口号");
}
const env = {
  ...process.env,
  NODE_ENV: "development",
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || `http://localhost:${clientPort}`,
};
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
  const timer = setTimeout(() => process.exit(code), 1500);
  timer.unref();
}

for (const command of [
  ["--watch", "server/index.js"],
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", clientPort, "--strictPort"],
]) {
  const child = spawn(process.execPath, command, { cwd: root, env, stdio: "inherit", windowsHide: true });
  children.push(child);
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => { if (!stopping) stop(code || 0); });
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
