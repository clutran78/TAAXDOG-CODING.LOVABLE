import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { hashPassword, validatePassword, createVerificationToken, logAuthEvent as logAuth } from "../../../lib/auth";
import { TaxResidency, AuthEvent } from "../../../generated/prisma";
import { InputValidator } from "../../../lib/security/middleware";
import { sendVerificationEmail } from "../../../lib/email";

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0] : req.socket.remoteAddress;
  return `register:${ip || "unknown"}`;
}

function checkRateLimit(req: NextApiRequest): boolean {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + 60 * 1000, // 1 minute window
    });
    return true;
  }

  if (limit.count >= 5) {
    // Max 5 registration attempts per minute
    return false;
  }

  limit.count++;
  return true;
}

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

  // Check rate limit
  if (!checkRateLimit(req)) {
    await logAuth({
      event: "REGISTER",
      success: false,
      metadata: {
        reason: "Rate limit exceeded",
      },
      req,
    });
    return res.status(429).json({ message: "Too many requests. Please try again later." });
  }

  try {
    const { 
      email, 
      password, 
      name, 
      phone, 
      abn, 
      taxResidency,
      privacyConsent,
    } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Email, password, and name are required" });
    }

    // Validate email format
    if (!InputValidator.isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
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

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: "Password does not meet requirements",
        errors: passwordValidation.errors,
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      await logAuth({
        event: "REGISTER",
        success: false,
        metadata: {
          reason: "Email already exists",
          email,
        },
        req,
      });
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Validate ABN if provided
    if (abn && !InputValidator.isValidABN(abn)) {
      return res.status(400).json({ message: "Invalid ABN format" });
    }
    
    // Sanitize inputs
    const sanitizedName = InputValidator.sanitizeInput(name);
    const sanitizedPhone = phone ? phone.replace(/\s/g, '') : null;

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with privacy consent tracking
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: sanitizedName,
        phone: sanitizedPhone,
        abn: abn ? abn.replace(/\s/g, "") : null,
        taxResidency: (taxResidency as TaxResidency) || TaxResidency.RESIDENT,
        // Store privacy consent in audit log
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    
    // Create verification token
    const verificationToken = await createVerificationToken(user.email);
    
    // Store privacy consent
    await prisma.auditLog.create({
      data: {
        event: AuthEvent.REGISTER,
        userId: user.id,
        ipAddress: req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress || "0.0.0.0",
        userAgent: req.headers["user-agent"] || "",
        success: true,
        metadata: {
          privacyConsent: {
            ...privacyConsent,
            timestamp: new Date(),
          },
        },
      },
    });

    // Log successful registration
    await logAuth({
      event: "REGISTER",
      userId: user.id,
      success: true,
      metadata: {
        email: user.email,
        hasABN: !!abn,
        taxResidency,
      },
      req,
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.name, verificationToken);

    res.status(201).json({
      message: "Account created successfully. Please check your email to verify your account.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      requiresVerification: true,
    });
  } catch (error) {
    console.error("Registration error:", error);
    await logAuth({
      event: "REGISTER",
      success: false,
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      req,
    });
    res.status(500).json({ message: "An error occurred during registration" });
  }
}