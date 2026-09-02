import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let pool: mysql.Pool | null = null;

export function getDb() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      "mysql://root:root@127.0.0.1:3307/ekinerja";

    // Parse URL manually so special characters in password (like @) are
    // correctly decoded regardless of how mysql2 handles the uri option.
    const url = new URL(connectionString);
    pool = mysql.createPool({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      waitForConnections: true,
      connectionLimit: 10,
      // Return DATETIME/DATE/TIMESTAMP as strings so Drizzle
      // varchar columns receive string values directly.
      dateStrings: true,
    });
  }

  return drizzle(pool, { schema, mode: "default" });
}
