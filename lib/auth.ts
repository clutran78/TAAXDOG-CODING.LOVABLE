import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { Role } from "../generated/prisma";

export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma), // Temporarily removed for compatibility
  providers: [
    // Google OAuth - configure in environment files to enable
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log("Auth attempt for:", credentials?.email); // Debug log
        
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        console.log("User found:", user ? "Yes" : "No"); // Debug log

        if (!user || !user.password) {
          // Log failed login attempt
          await logAuthEvent({
            event: "LOGIN_FAILED",
            email: credentials.email,
            success: false,
            metadata: { reason: "User not found or no password set" }
          });
          throw new Error("Invalid credentials");
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await logAuthEvent({
            event: "LOGIN_FAILED",
            userId: user.id,
            success: false,
            metadata: { reason: "Account locked" }
          });
          throw new Error("Account locked. Please try again later.");
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

        if (!isPasswordValid) {
          // Increment failed login attempts
          const failedAttempts = user.failedLoginAttempts + 1;
          const shouldLock = failedAttempts >= 5;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: failedAttempts,
              ...(shouldLock && {
                lockedUntil: new Date(Date.now() + 30 * 60 * 1000) // Lock for 30 minutes
              })
            }
          });

          await logAuthEvent({
            event: shouldLock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
            userId: user.id,
            success: false,
            metadata: { failedAttempts }
          });

          throw new Error(shouldLock ? "Account locked due to multiple failed attempts" : "Invalid credentials");
        }

        // Reset failed login attempts on successful login
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lastLoginAt: new Date(),
            lockedUntil: null
          }
        });

        await logAuthEvent({
          event: "LOGIN_SUCCESS",
          userId: user.id,
          success: true
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        };
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async signIn({ user, account }) {
      // Log successful OAuth login
      if (account?.provider !== "credentials") {
        await logAuthEvent({
          event: "LOGIN_SUCCESS",
          userId: user.id!,
          success: true,
          metadata: { provider: account?.provider }
        });
      }
      return true;
    },
  },
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
    newUser: "/auth/welcome"
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};


// Australian standard compliant password validation
export function validatePassword(password: string): { valid: boolean; errors: string[]; score: number } {
  const errors: string[] = [];
  let score = 0;
  
  // Length requirements
  if (password.length < 12) {
    errors.push("Password must be at least 12 characters long");
  } else {
    score += 2;
    if (password.length >= 16) score += 1;
  }
  
  // Character variety requirements
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain lowercase letters");
  } else {
    score += 1;
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain uppercase letters");
  } else {
    score += 1;
  }
  
  if (!/\d/.test(password)) {
    errors.push("Password must contain numbers");
  } else {
    score += 1;
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain special characters");
  } else {
    score += 1;
  }
  
  // Common patterns check
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /admin/i,
    /letmein/i,
    /welcome/i,
    /monkey/i,
    /dragon/i,
  ];
  
  if (commonPatterns.some(pattern => pattern.test(password))) {
    errors.push("Password contains common patterns");
    score = Math.max(0, score - 2);
  }
  
  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push("Password contains repeated characters");
    score = Math.max(0, score - 1);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    score: Math.min(score, 10),
  };
}

// Hash password helper
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Generate secure token helper
function generateSecureToken(): string {
  return Array.from({ length: 32 }, () => 
    Math.random().toString(36)[2] || Math.random().toString(36)[3]
  ).join('');
}

// Enhanced audit logging with request context
export async function logAuthEvent({
  event,
  userId = null,
  email = null,
  success = true,
  metadata = null,
  req = null,
}: {
  event: string;
  userId?: string | null;
  email?: string | null;
  success?: boolean;
  metadata?: any;
  req?: any;
}) {
  try {
    // Extract request context
    const ipAddress = req?.headers?.['x-forwarded-for']?.split(',')[0] || 
                     req?.headers?.['x-real-ip'] || 
                     req?.socket?.remoteAddress || 
                     "0.0.0.0";
    const userAgent = req?.headers?.['user-agent'] || "";
    
    // If email provided but no userId, try to find user
    if (email && !userId) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      userId = user?.id || null;
    }
    
    await prisma.auditLog.create({
      data: {
        event: event as any,
        userId,
        ipAddress,
        userAgent,
        success,
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to log auth event:", error);
  }
}

// Check if email is verified
export async function isEmailVerified(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });
  return !!user?.emailVerified;
}

// Create verification token
export async function createVerificationToken(email: string): Promise<string> {
  const token = generateSecureToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });
  
  return token;
}

// Create password reset token
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = generateSecureToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  // Delete any existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { 
      identifier: email,
      token: { startsWith: 'reset_' },
    },
  });
  
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: `reset_${token}`,
      expires,
    },
  });
  
  return token;
}

// Verify password reset token
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token: `reset_${token}`,
      expires: { gt: new Date() },
    },
  });
  
  return verificationToken?.identifier || null;
}

// Update user password
export async function updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    const hashedPassword = await hashPassword(newPassword);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        // Clear any lockout
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    
    // Log password change
    await logAuthEvent({
      event: "PASSWORD_CHANGE",
      userId,
      success: true,
    });
    
    return true;
  } catch (error) {
    console.error("Failed to update password:", error);
    return false;
  }
}