import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Role } from "../../generated/prisma";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

// Role hierarchy for permission checking
const roleHierarchy: Record<Role, number> = {
  [Role.USER]: 1,
  [Role.ACCOUNTANT]: 2,
  [Role.SUPPORT]: 3,
  [Role.ADMIN]: 4,
};

// Check if user has required role or higher
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Middleware for protected routes
export async function withAuth(
  request: NextRequest,
  requiredRole?: Role
): Promise<NextResponse | null> {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // Check role if required
    if (requiredRole && !hasRole(token.role as Role, requiredRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Add user info to headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", token.id as string);
    requestHeaders.set("x-user-email", token.email as string);
    requestHeaders.set("x-user-role", token.role as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error("Auth middleware error:", error);
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
}

// API route authentication wrapper
export function requireAuth(handler: Function, requiredRole?: Role) {
  return async (req: any, res: any) => {
    const session = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (requiredRole && !hasRole(session.role as Role, requiredRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    // Add user to request
    req.user = {
      id: session.id,
      email: session.email,
      role: session.role,
    };

    return handler(req, res);
  };
}

// Rate limiting middleware
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  windowMs: number = 60000, // 1 minute
  maxRequests: number = 60
) {
  return (req: NextRequest): boolean => {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0] || "unknown";
    const key = `${req.nextUrl.pathname}:${ip}`;
    const now = Date.now();
    const limit = rateLimitStore.get(key);

    if (!limit || now > limit.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (limit.count >= maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  };
}

// CSRF token validation
export function validateCSRFToken(req: NextRequest): boolean {
  const token = req.headers.get("x-csrf-token");
  const cookieToken = req.cookies.get("csrf-token")?.value;

  if (!token || !cookieToken || token !== cookieToken) {
    return false;
  }

  return true;
}

// Security headers middleware
export function securityHeaders(response: NextResponse): NextResponse {
  // HSTS
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;"
  );

  // Permissions policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)"
  );

  return response;
}