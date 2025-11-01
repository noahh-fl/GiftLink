import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outputDir = join(projectRoot, ".tmp", "frontend-tests");
const testEntries = [
  join(projectRoot, "src/utils/price.test.ts"),
  join(projectRoot, "src/pages/__tests__/SpaceWishlist.test.ts"),
];

async function compileTests() {
  await rm(outputDir, { recursive: true, force: true }).catch(() => {});
  await mkdir(outputDir, { recursive: true });

  const compiled = [];
  for (const entry of testEntries) {
    const outfile = join(outputDir, `${basename(entry).replace(/\.tsx?$/, "")}.mjs`);
    await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      format: "esm",
      platform: "node",
      target: ["node20"],
      sourcemap: false,
      loader: {
        ".ts": "ts",
        ".tsx": "tsx",
      },
      define: {
        "import.meta.env": "{}",
      },
      logLevel: "silent",
    });
    compiled.push(outfile);
  }
  return compiled;
}

async function runNodeTests(files) {
  await new Promise((resolve, reject) => {
    const proc = spawn("node", ["--test", ...files], { stdio: "inherit" });
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Frontend tests failed with code ${code}`));
      }
    });
    proc.on("error", (error) => {
      reject(error);
    });
  });
}

try {
  const compiledFiles = await compileTests();
  await runNodeTests(compiledFiles);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
