import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // Custom logic can go here
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // Protect all routes except auth, api/auth, and public assets
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};