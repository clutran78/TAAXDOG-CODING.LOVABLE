import { NextRequest, NextResponse } from "next/server";
import { withAuth, validateCSRFToken } from "./lib/middleware/auth";
import { Role } from "@prisma/client";

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
  const response = NextResponse.next();

  // Apply security headers globally
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS header for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // CSP header
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.stripe.com https://api.openai.com https://api.anthropic.com https://au-api.basiq.io",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    process.env.NODE_ENV === 'production' ? "upgrade-insecure-requests" : "",
  ].filter(Boolean).join('; ');
  
  response.headers.set('Content-Security-Policy', cspDirectives);

  // Check CSRF for protected API routes
  if (csrfProtectedRoutes.some(route => pathname.startsWith(route))) {
    if (request.method !== "GET" && !validateCSRFToken(request)) {
      return new NextResponse("Invalid CSRF Token", { status: 403 });
    }
  }

  // Skip auth for public routes
  if (publicRoutes.some(route => pathname === route)) {
    return response;
  }

  // Skip auth for static files and API routes (except protected ones)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    (pathname.startsWith("/api") && !pathname.startsWith("/api/protected"))
  ) {
    return response;
  }

  // Check authentication for protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const authResponse = await withAuth(request);
    if (authResponse) {
      // Copy security headers to auth response
      response.headers.forEach((value, key) => {
        authResponse.headers.set(key, value);
      });
      return authResponse;
    }
  }

  // Check role-based access
  for (const [route, requiredRole] of Object.entries(roleProtectedRoutes)) {
    if (pathname.startsWith(route)) {
      const authResponse = await withAuth(request, requiredRole);
      if (authResponse) {
        // Copy security headers to auth response
        response.headers.forEach((value, key) => {
          authResponse.headers.set(key, value);
        });
        return authResponse;
      }
    }
  }

  return response;
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