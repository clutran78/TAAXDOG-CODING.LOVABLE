// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const isAuth = !!token;

  const publicPaths = ['/login', '/sign-up', '/forgot-password'];

  if (!isAuth && !publicPaths.includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/sign-up', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|public).*)',
  ],
};
