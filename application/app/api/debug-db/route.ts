import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export async function GET() {
  const connectionString =
    process.env.DATABASE_URL || "mysql://root:root@127.0.0.1:3307/ekinerja";

  const result: Record<string, unknown> = { connectionString: connectionString.replace(/:([^@]+)@/, ":***@") };

  try {
    const url = new URL(connectionString);
    result.parsed = {
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password).replace(/./g, "*"),
      database: url.pathname.replace(/^\//, ""),
    };

    const pool = mysql.createPool({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      waitForConnections: true,
      connectionLimit: 2,
      dateStrings: true,
    });

    const [rows] = await pool.query("SELECT email, status FROM system_accounts LIMIT 3");
    result.status = "SUCCESS";
    result.rows = rows;
    await pool.end();
  } catch (err: unknown) {
    result.status = "ERROR";
    result.error = String(err);
    result.code = (err as { code?: string })?.code;
    result.sqlMessage = (err as { sqlMessage?: string })?.sqlMessage;
    result.errno = (err as { errno?: number })?.errno;
    const cause = (err as { cause?: unknown })?.cause;
    if (cause) {
      result.cause = {
        message: (cause as { message?: string })?.message,
        code: (cause as { code?: string })?.code,
      };
    }
  }

  return NextResponse.json(result);
}
