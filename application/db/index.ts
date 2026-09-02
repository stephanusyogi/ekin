import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

let pool: mysql.Pool | null = null;

export function getDb() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ||
      "mysql://root:root@127.0.0.1:3307/ekinerja";

    const url = new URL(connectionString);
    const socketPath = process.env.MYSQL_SOCKET; // e.g. /var/lib/mysql/mysql.sock

    const baseConfig = {
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      waitForConnections: true,
      connectionLimit: 10,
      dateStrings: true,
    };

    if (socketPath) {
      // Use Unix socket (required on many shared hosts like Hostinger)
      pool = mysql.createPool({ ...baseConfig, socketPath });
    } else {
      pool = mysql.createPool({
        ...baseConfig,
        host: url.hostname,
        port: parseInt(url.port) || 3306,
      });
    }
  }

  return drizzle(pool, { schema, mode: "default" });
}
