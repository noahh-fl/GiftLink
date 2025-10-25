// ✅ this line loads backend/.env for Prisma v6
import "dotenv/config";

import { defineConfig } from "prisma/config";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const fallbackDatabaseUrl = pathToFileURL(path.join(configDir, "prisma", "dev.db")).toString();
const databaseUrl = process.env.DATABASE_URL ?? fallbackDatabaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
});
