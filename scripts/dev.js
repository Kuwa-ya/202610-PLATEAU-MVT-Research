import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { freePort } from "./free-port.js";

const port = Number.parseInt(process.env.PORT ?? "4173", 10);
freePort(port);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const servePath = resolve(scriptDir, "serve.js");

const child = spawn(process.execPath, [servePath], {
  stdio: "inherit",
  env: process.env,
  cwd: resolve(scriptDir, ".."),
});

child.on("exit", code => {
  process.exitCode = code ?? 0;
});
