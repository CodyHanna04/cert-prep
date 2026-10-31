import { NextResponse } from "next/server";

/**
 * Deployment mode gate (docs/11-auth-and-tenancy.md section 2.6). The same image runs twice:
 *  - APP_MODE=web   (public):  /admin does not exist.
 *  - APP_MODE=admin (tailnet): only /admin exists; everything else is 404.
 */
export function proxy(request) {
  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const admin = process.env.APP_MODE === "admin";

  if (admin) {
    if (pathname === "/") return NextResponse.redirect(new URL("/admin", request.url));
    if (!isAdminPath) return new NextResponse("Not found", { status: 404 });
  } else if (isAdminPath) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
