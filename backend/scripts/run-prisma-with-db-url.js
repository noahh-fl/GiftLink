#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptsDir, "..");
const prismaBinary = path.join(
  backendDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);
const dbFile = path.join(backendDir, "prisma", "dev.db");
const databaseUrl = process.env.DATABASE_URL ?? pathToFileURL(dbFile).toString();
const args = process.argv.slice(2);

const child = spawn(prismaBinary, args, {
  cwd: backendDir,
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

child.on("exit", (code, signal) => {
  if (typeof code === "number") {
    process.exit(code);
  }
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(1);
  }
});
