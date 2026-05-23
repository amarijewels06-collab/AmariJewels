import { NextResponse, type NextRequest } from "next/server";

const accessCookie = "amari_access";
const protectedPrefixes = [
  "/dashboard",
  "/customers",
  "/suppliers",
  "/stock",
  "/designs",
  "/sales",
  "/settings",
  "/profile",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = Boolean(request.cookies.get(accessCookie)?.value);
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtected && !hasAccessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/" || pathname === "/login") && hasAccessToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/customers/:path*", "/suppliers/:path*", "/stock/:path*", "/designs/:path*", "/sales/:path*", "/settings/:path*", "/profile/:path*"],
};
