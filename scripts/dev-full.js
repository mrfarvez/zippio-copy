import { spawn } from "node:child_process";

const processes = [
  process.platform === "win32"
    ? spawn("node", ["server/index.js"], { stdio: "inherit" })
    : spawn("node", ["server/index.js"], { stdio: "inherit" }),
  process.platform === "win32"
    ? spawn("node", ["node_modules/vite/bin/vite.js"], { stdio: "inherit" })
    : spawn("node", ["node_modules/vite/bin/vite.js"], { stdio: "inherit" }),
];

function shutdown() {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
for (const child of processes) child.on("exit", (code) => {
  if (code && code !== 0) process.exitCode = code;
});
