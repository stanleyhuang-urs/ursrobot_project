import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireBoardAdmin } from "@/lib/permissions";
import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_RETURN_TO_COOKIE,
  GOOGLE_SHEETS_SCOPE,
  googleRedirectUri,
  isSafeReturnPath,
} from "@/lib/googleAuth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  try {
    requireBoardAdmin(session.role);
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : "權限不足", {
      status: 403,
    });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new NextResponse("伺服器尚未設定 GOOGLE_CLIENT_ID", { status: 500 });
  }

  const state = randomUUID();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", googleRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_SHEETS_SCOPE);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  const returnTo = request.nextUrl.searchParams.get("returnTo");
  if (isSafeReturnPath(returnTo)) {
    res.cookies.set(GOOGLE_RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
  }
  return res;
}
