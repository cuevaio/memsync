import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "./env";
import * as schema from "./schema";

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;
let sqlClient: postgres.Sql | null = null;

export function nowIso() {
  return new Date().toISOString();
}

export function getDatabaseUrl() {
  return env.DATABASE_URL ?? null;
}

export function getDb() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!dbInstance) {
    sqlClient = postgres(databaseUrl, {
      prepare: false,
    });
    dbInstance = drizzle(sqlClient, { schema });
  }

  return dbInstance;
}
