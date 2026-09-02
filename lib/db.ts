import "server-only";

import { Pool, type QueryResultRow } from "pg";

export type DbParam = string | number | boolean | Date | null;
export type DbRow = QueryResultRow & Record<string, unknown>;

const databaseUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;

export function hasDatabaseConnection() {
  return Boolean(databaseUrl);
}

export function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function getPool() {
  if (!databaseUrl) {
    throw new Error("Database connection string is not configured.");
  }
  pool ??= new Pool({
    connectionString: databaseUrl,
    max: 5,
  });
  return pool;
}

function postgresSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function queryRows<TRow extends DbRow>(
  sql: string,
  params: DbParam[] = [],
): Promise<TRow[]> {
  const result = await getPool().query<TRow>(postgresSql(sql), params);
  return result.rows;
}
