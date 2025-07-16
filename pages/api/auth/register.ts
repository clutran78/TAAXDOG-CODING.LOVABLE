import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { 
  hashPassword, 
  generateEmailVerificationToken,
  generateJWT,
  sanitizeUser,
  getClientIP,
  getAuthCookieOptions,
  validatePasswordStrength
} from "../../../lib/auth/auth-utils";
import { registerSchema, validateInput } from "../../../lib/auth/validation";
import { authRateLimiter } from "../../../lib/auth/rate-limiter";
import { sendVerificationEmail } from "../../../lib/email";
import { TaxResidency, AuthEvent } from "../../../generated/prisma";
import { InputValidator } from "../../../lib/security/middleware";

// Privacy consent tracking
interface PrivacyConsent {
  termsAccepted: boolean;
  privacyPolicyAccepted: boolean;
  marketingOptIn?: boolean;
  dataCollectionConsent: boolean;
  timestamp: Date;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Apply rate limiting
  const rateLimitOk = await authRateLimiter(req, res);
  if (!rateLimitOk) return;

  const startTime = Date.now();
  const clientIp = getClientIP(req);

  try {
    // Validate input with Zod schema
    const validation = validateInput(registerSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        errors: validation.errors 
      });
    }

    const { email, password, name } = validation.data;
    const { phone, abn, taxResidency, privacyConsent } = req.body;

    // Additional password strength check
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: "Password does not meet requirements",
        errors: { password: passwordValidation.errors }
      });
    }
    
    // Validate phone if provided
    if (phone && !InputValidator.isValidAustralianPhone(phone)) {
      return res.status(400).json({ message: "Invalid Australian phone number format" });
    }
    
    // Check privacy consent (Australian Privacy Principles compliance)
    if (!privacyConsent?.termsAccepted || !privacyConsent?.privacyPolicyAccepted || !privacyConsent?.dataCollectionConsent) {
      return res.status(400).json({ 
        message: "You must accept the terms of service, privacy policy, and consent to data collection" 
      });
    }

    // Validate ABN if provided
    if (abn && !InputValidator.isValidABN(abn)) {
      return res.status(400).json({ message: "Invalid ABN format" });
    }

    // Start transaction for atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Check if user already exists
      const existingUser = await tx.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true }
      });

      if (existingUser) {
        throw new Error('EMAIL_EXISTS');
      }

      // Generate email verification token
      const { token: verificationToken, expires: verificationExpires } = generateEmailVerificationToken();

      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Sanitize inputs
      const sanitizedPhone = phone ? phone.replace(/\s/g, '') : null;

      // Create user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          name,
          phone: sanitizedPhone,
          abn: abn ? abn.replace(/\s/g, "") : null,
          taxResidency: (taxResidency as TaxResidency) || TaxResidency.RESIDENT,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
          lastLoginIp: clientIp,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          event: AuthEvent.REGISTER,
          userId: user.id,
          ipAddress: clientIp,
          userAgent: req.headers["user-agent"] || "",
          success: true,
          metadata: {
            email: user.email,
            hasABN: !!abn,
            taxResidency,
            privacyConsent: privacyConsent ? {
              ...privacyConsent,
              timestamp: new Date(),
            } : null,
          },
        },
      });

      return { user, verificationToken };
    });

    // Send verification email (outside transaction)
    try {
      await sendVerificationEmail(
        result.user.email,
        result.user.name,
        result.verificationToken
      );
    } catch (emailError) {
      console.error('[Register] Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Generate JWT token
    const token = generateJWT({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    // Set auth cookie
    const isDevelopment = process.env.NODE_ENV !== 'production';
    res.setHeader('Set-Cookie', [
      `auth-token=${token}; ${Object.entries(getAuthCookieOptions(isDevelopment))
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')}`,
    ]);

    // Log successful registration
    const duration = Date.now() - startTime;
    console.log('[Register] User registered successfully:', {
      userId: result.user.id,
      email: result.user.email,
      duration: `${duration}ms`,
      ip: clientIp,
    });

    // Return success response
    res.status(201).json({
      message: "Account created successfully. Please check your email to verify your account.",
      user: sanitizeUser(result.user),
      requiresVerification: true,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Log error
    console.error('[Register] Registration failed:', {
      error: error.message,
      code: error.code,
      duration: `${duration}ms`,
      ip: clientIp,
      email: req.body.email,
    });

    // Handle specific errors
    if (error.message === 'EMAIL_EXISTS') {
      return res.status(409).json({
        error: 'Registration failed',
        message: 'An account with this email already exists.',
      });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Registration failed',
        message: 'An account with this email already exists.',
      });
    }

    // Generic error response
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
}