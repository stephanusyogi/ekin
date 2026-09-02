import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let pool: mysql.Pool | null = null;

export function getDb() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      "mysql://root:root@127.0.0.1:3307/ekinerja";

    pool = mysql.createPool(connectionString);
  }

  return drizzle(pool, { schema, mode: "default" });
}
