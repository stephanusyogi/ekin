import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { activeUserSessions, sessionAuditLogs } from "../../../../db/schema";
import { clientIp, requestIdentity } from "../../../lib/access";

export async function GET(request: Request) {
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  try {
    const identity = requestIdentity(request);
    if (identity?.email) {
      const db = getDb();
      await db
        .delete(activeUserSessions)
        .where(eq(activeUserSessions.userEmail, identity.email));
      await db.insert(sessionAuditLogs).values({
        userEmail: identity.email,
        action: "LOGOUT",
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent") || "",
        detail: "Logout aplikasi",
      });
    }
  } catch {
    // Ignore error if user was not logged in
  }

  const response = NextResponse.redirect(`${appUrl}/`);
  response.cookies.set("ekinerja_session", "", { path: "/", maxAge: 0 });
  response.cookies.set("ekinerja_auth", "", { path: "/", maxAge: 0 });
  response.cookies.set("ekinerja_session_state", "", { path: "/", maxAge: 0 });

  return response;
}
