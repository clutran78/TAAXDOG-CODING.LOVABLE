import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { logAuthEvent } from "../../../lib/auth";
import { sendWelcomeEmail } from "../../../lib/email";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      await logAuthEvent({
        event: "EMAIL_VERIFICATION",
        success: false,
        metadata: { reason: "Invalid token" },
        req,
      });
      return res.status(400).json({ 
        message: "Invalid verification token. Please request a new verification email." 
      });
    }

    // Check if token is expired
    if (verificationToken.expires < new Date()) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: { token },
      });
      
      await logAuthEvent({
        event: "EMAIL_VERIFICATION",
        success: false,
        metadata: { reason: "Expired token" },
        req,
      });
      return res.status(400).json({ 
        message: "Verification token has expired. Please request a new verification email." 
      });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier },
    });

    if (!user) {
      await logAuthEvent({
        event: "EMAIL_VERIFICATION",
        success: false,
        metadata: { reason: "User not found" },
        req,
      });
      return res.status(400).json({ message: "Invalid verification token" });
    }

    // Check if already verified
    if (user.emailVerified) {
      // Clean up token
      await prisma.verificationToken.delete({
        where: { token },
      });
      
      return res.status(200).json({ 
        message: "Email already verified",
        alreadyVerified: true,
      });
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        emailVerified: new Date(),
        // Clear any lockouts on verification
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: { token },
    });

    // Log successful verification
    await logAuthEvent({
      event: "EMAIL_VERIFICATION",
      userId: user.id,
      success: true,
      req,
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.name);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    res.status(200).json({ 
      message: "Email verified successfully! You can now access all features.",
      success: true,
    });
  } catch (error) {
    console.error("Email verification error:", error);
    await logAuthEvent({
      event: "EMAIL_VERIFICATION",
      success: false,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
      req,
    });
    res.status(500).json({ message: "An error occurred during email verification" });
  }
}

// Resend verification email endpoint
export async function resendVerificationEmail(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({ 
        message: "If an account exists with this email, a verification email will be sent." 
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(200).json({ 
        message: "Email is already verified",
        alreadyVerified: true,
      });
    }

    // Check for recent verification emails (rate limiting)
    const recentTokens = await prisma.verificationToken.count({
      where: {
        identifier: email,
        expires: { gt: new Date() },
        token: { not: { startsWith: 'reset_' } },
      },
    });

    if (recentTokens >= 3) {
      await logAuthEvent({
        event: "EMAIL_VERIFICATION",
        userId: user.id,
        success: false,
        metadata: { reason: "Too many verification attempts" },
        req,
      });
      return res.status(429).json({ 
        message: "Too many verification emails requested. Please try again later." 
      });
    }

    // Create new verification token
    const { createVerificationToken } = await import("../../../lib/auth");
    const newToken = await createVerificationToken(email);

    // Send verification email
    const { sendVerificationEmail } = await import("../../../lib/email");
    await sendVerificationEmail(email, user.name, newToken);

    // Log resend attempt
    await logAuthEvent({
      event: "EMAIL_VERIFICATION",
      userId: user.id,
      success: true,
      metadata: { action: "resend" },
      req,
    });

    res.status(200).json({ 
      message: "Verification email sent successfully",
      success: true,
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "An error occurred sending verification email" });
  }
}