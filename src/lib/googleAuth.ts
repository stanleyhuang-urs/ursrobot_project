export const GOOGLE_TOKEN_COOKIE = "google_sheets_token";
export const GOOGLE_STATE_COOKIE = "google_oauth_state";
export const GOOGLE_RETURN_TO_COOKIE = "google_oauth_return_to";
export const GOOGLE_SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

export function googleRedirectUri(): string {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/auth/google/callback`;
}

/** Only allow redirecting back to a same-app relative path, never an
 *  external URL — a bare "/x" is safe, "//x" or "https://x" are not. */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}
