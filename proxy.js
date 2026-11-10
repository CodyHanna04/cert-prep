import { NextResponse } from "next/server";
import { buildCsp, makeNonce } from "./lib/app/csp.js";

/**
 * Runs before every page request.
 *
 * Deployment mode gate (docs/11-auth-and-tenancy.md section 2.6). The same image runs twice:
 *  - APP_MODE=web   (public):  /admin does not exist.
 *  - APP_MODE=admin (tailnet): only /admin exists; everything else is 404.
 *
 * Content Security Policy: a fresh nonce per request. Next.js reads it from the request's CSP header and puts it on
 * its own scripts; the same policy goes out on the response. Every page renders per request (the root layout reads
 * the theme cookie), so no page is served from a build-time copy without the nonce.
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const admin = process.env.APP_MODE === "admin";
  const csp = buildCsp(makeNonce(), { dev: process.env.NODE_ENV !== "production" });

  let response;
  if (admin && pathname === "/") response = NextResponse.redirect(new URL("/admin", request.url));
  else if (admin ? !isAdminPath : isAdminPath) response = new NextResponse("Not found", { status: 404 });
  else {
    const headers = new Headers(request.headers);
    headers.set("content-security-policy", csp);
    response = NextResponse.next({ request: { headers } });
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
