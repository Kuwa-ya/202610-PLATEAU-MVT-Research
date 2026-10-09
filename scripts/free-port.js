import { execSync } from "node:child_process";

/**
 * @param {number} port
 * @returns {number[]} PIDs listening on port
 */
export function findListeningPids(port) {
  if (process.platform === "win32") {
    const output = execSync("netstat -ano", { encoding: "utf8" });
    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      if (!line.includes(`:${port}`)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number.parseInt(parts.at(-1) ?? "", 10);
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  }
  try {
    const output = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
    if (!output) return [];
    return output.split(/\s+/).map(v => Number.parseInt(v, 10)).filter(n => n > 0);
  } catch {
    return [];
  }
}

/**
 * @param {number} port
 */
export function freePort(port) {
  const ownPid = process.pid;
  for (const pid of findListeningPids(port)) {
    if (pid === ownPid) continue;
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } else {
        process.kill(pid, "SIGTERM");
      }
      console.log(`ポート ${port}: PID ${pid} を終了しました`);
    } catch {
      console.warn(`ポート ${port}: PID ${pid} を終了できませんでした`);
    }
  }
}
