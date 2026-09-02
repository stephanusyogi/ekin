import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../../db";
import { activeUserSessions, employees, sessionAuditLogs, systemAccounts } from "../../../../../db/schema";
import { clientIp, hashSessionToken } from "../../../../lib/access";
import { signToken } from "../../../../lib/auth-utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?error=no_code`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = `${appUrl}/api/auth/callback/google`;

  try {
    // 1. Exchange authorization code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Google Token Error:", err);
      return NextResponse.redirect(`${appUrl}/?error=token_failed`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch userinfo from Google
    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl}/?error=userinfo_failed`);
    }

    const userData = await userRes.json();
    const email = userData.email?.trim().toLowerCase();
    const name = userData.name || userData.email;

    if (!email) {
      return NextResponse.redirect(`${appUrl}/?error=no_email`);
    }

    // 3. Verify user in Database (system_accounts or employees)
    const db = getDb();
    const [system] = await db
      .select()
      .from(systemAccounts)
      .where(eq(systemAccounts.email, email))
      .limit(1);

    let authorized = false;
    let displayName = name;

    if (system && system.status === "Aktif") {
      authorized = true;
      displayName = system.displayName || name;
    } else {
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.email, email))
        .limit(1);

      if (
        employee &&
        employee.employeeStatus === "Aktif" &&
        employee.accountStatus === "Aktif"
      ) {
        authorized = true;
        displayName = employee.fullName || name;
      }
    }

    if (!authorized) {
      return NextResponse.redirect(
        `${appUrl}/?error=unauthorized&email=${encodeURIComponent(email)}`,
      );
    }

    // 4. Create session and update activeUserSessions
    const SESSION_SECONDS = 24 * 60 * 60;
    const token = crypto.randomUUID() + crypto.randomUUID();
    const sessionHash = await hashSessionToken(token);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SESSION_SECONDS * 1000,
    ).toISOString().slice(0, 19).replace('T', ' ');
    const ip = clientIp(request);
    const agent = request.headers.get("user-agent") || "";

    const [existingSession] = await db
      .select()
      .from(activeUserSessions)
      .where(eq(activeUserSessions.userEmail, email))
      .limit(1);

    if (existingSession) {
      await db
        .update(activeUserSessions)
        .set({
          sessionHash,
          createdAt: now.toISOString().slice(0, 19).replace('T', ' '),
          lastActivityAt: now.toISOString().slice(0, 19).replace('T', ' '),
          expiresAt,
          ipAddress: ip,
          userAgent: agent,
        })
        .where(eq(activeUserSessions.userEmail, email));
    } else {
      await db.insert(activeUserSessions).values({
        userEmail: email,
        sessionHash,
        createdAt: now.toISOString().slice(0, 19).replace('T', ' '),
        lastActivityAt: now.toISOString().slice(0, 19).replace('T', ' '),
        expiresAt,
        ipAddress: ip,
        userAgent: agent,
      });
    }

    await db.insert(sessionAuditLogs).values({
      userEmail: email,
      action: "LOGIN",
      ipAddress: ip,
      userAgent: agent,
      detail: "Login berhasil via Google OAuth",
    });

    // 5. Create signed auth token for client identity
    const authToken = signToken({ email, name: displayName });

    const response = NextResponse.redirect(`${appUrl}/`);
    response.cookies.set("ekinerja_session", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_SECONDS,
    });
    response.cookies.set("ekinerja_auth", authToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Google Auth Callback Error:", error);
    return NextResponse.redirect(`${appUrl}/?error=server_error`);
  }
}
