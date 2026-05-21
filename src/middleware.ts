import { type NextRequest, NextResponse } from "next/server";

import { isAuthPath, isProtectedPath } from "@/lib/auth/permissions";

const sessionCookieNames = ["authjs.session-token", "__Secure-authjs.session-token"];

export default function middleware(request: NextRequest) {
  const nextUrl = new URL(request.url);
  const cookieHeader = request.headers.get("cookie") ?? "";
  const hasSessionCookie = sessionCookieNames.some((cookieName) =>
    cookieHeader.includes(`${cookieName}=`)
  );

  if (isProtectedPath(nextUrl.pathname) && !hasSessionCookie) {
    const signInUrl = new URL("/sign-in", nextUrl);
    signInUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthPath(nextUrl.pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js|workbox-.*|.*\\..*).*)"
  ]
};
