import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_TOKEN_COOKIE,
  GOOGLE_RETURN_TO_COOKIE,
  googleRedirectUri,
  isSafeReturnPath,
} from "@/lib/googleAuth";

// Token lifetime is capped short since it's only meant to be used once, for
// the single Google Sheet fetch the user is about to retry — not persisted.
const TOKEN_COOKIE_MAX_AGE_SECONDS = 300;

export async function GET(request: NextRequest) {
  const returnTo = request.cookies.get(GOOGLE_RETURN_TO_COOKIE)?.value;
  const target = isSafeReturnPath(returnTo) ? returnTo : "/";

  function redirectWithStatus(status: "success" | "error") {
    const res = NextResponse.redirect(
      new URL(`${target}?googleSheetsAuth=${status}`, request.url)
    );
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    res.cookies.delete(GOOGLE_RETURN_TO_COOKIE);
    return res;
  }

  const session = await getSession();
  if (!session) return redirectWithStatus("error");
  try {
    requireBoardAdmin(session.role);
  } catch {
    return redirectWithStatus("error");
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  if (oauthError) return redirectWithStatus("error");
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithStatus("error");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectWithStatus("error");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) return redirectWithStatus("error");
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenData.access_token) return redirectWithStatus("error");

  const res = redirectWithStatus("success");
  res.cookies.set(GOOGLE_TOKEN_COOKIE, tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.min(tokenData.expires_in ?? TOKEN_COOKIE_MAX_AGE_SECONDS, TOKEN_COOKIE_MAX_AGE_SECONDS),
  });
  return res;
}
