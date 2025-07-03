import { NextRequest, NextResponse } from "next/server";
import { withAuth, rateLimit, validateCSRFToken, securityHeaders } from "./lib/middleware/auth";
import { Role } from "./generated/prisma";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/profile",
  "/tax-returns",
  "/documents",
  "/settings",
];

// Routes that require specific roles
const roleProtectedRoutes: Record<string, Role> = {
  "/admin": Role.ADMIN,
  "/support": Role.SUPPORT,
  "/accountant": Role.ACCOUNTANT,
};

// Public routes that don't require authentication
const publicRoutes = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify",
  "/terms",
  "/privacy",
  "/pricing",
];

// API routes that require CSRF validation
const csrfProtectedRoutes = [
  "/api/profile",
  "/api/tax-returns",
  "/api/subscriptions",
  "/api/auth/change-password",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting
  const rateLimiter = rateLimit(60000, 100); // 100 requests per minute
  if (!rateLimiter(request)) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  // Check CSRF for protected API routes
  if (csrfProtectedRoutes.some(route => pathname.startsWith(route))) {
    if (request.method !== "GET" && !validateCSRFToken(request)) {
      return new NextResponse("Invalid CSRF Token", { status: 403 });
    }
  }

  // Skip auth for public routes
  if (publicRoutes.some(route => pathname === route)) {
    const response = NextResponse.next();
    return securityHeaders(response);
  }

  // Skip auth for static files and API routes (except protected ones)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    (pathname.startsWith("/api") && !pathname.startsWith("/api/protected"))
  ) {
    const response = NextResponse.next();
    return securityHeaders(response);
  }

  // Check authentication for protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const authResponse = await withAuth(request);
    if (authResponse) {
      return securityHeaders(authResponse);
    }
  }

  // Check role-based access
  for (const [route, requiredRole] of Object.entries(roleProtectedRoutes)) {
    if (pathname.startsWith(route)) {
      const authResponse = await withAuth(request, requiredRole);
      if (authResponse) {
        return securityHeaders(authResponse);
      }
    }
  }

  const response = NextResponse.next();
  return securityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};