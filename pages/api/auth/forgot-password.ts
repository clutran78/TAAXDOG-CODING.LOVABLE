import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { createPasswordResetToken, logAuthEvent } from "../../../lib/auth";
import { sendPasswordResetEmail } from "../../../lib/email";
import { InputValidator } from "../../../lib/security/middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    // Validate email format
    if (!InputValidator.isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      // Log failed attempt for security monitoring
      await logAuthEvent({
        event: "PASSWORD_RESET_REQUEST",
        email,
        success: false,
        metadata: { reason: "User not found" },
        req,
      });
      return res.status(200).json({ 
        message: "If an account exists with this email, you will receive password reset instructions." 
      });
    }
    
    // Check if user has too many recent reset attempts
    const recentAttempts = await prisma.verificationToken.count({
      where: {
        identifier: email,
        token: { startsWith: 'reset_' },
        expires: { gt: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      },
    });
    
    if (recentAttempts >= 3) {
      await logAuthEvent({
        event: "PASSWORD_RESET_REQUEST",
        userId: user.id,
        success: false,
        metadata: { reason: "Too many reset attempts" },
        req,
      });
      return res.status(200).json({ 
        message: "If an account exists with this email, you will receive password reset instructions." 
      });
    }

    // Generate reset token
    const resetToken = await createPasswordResetToken(email);

    // Send password reset email
    await sendPasswordResetEmail(email, user.name, resetToken);
    
    // Log successful request
    await logAuthEvent({
      event: "PASSWORD_RESET_REQUEST",
      userId: user.id,
      success: true,
      req,
    });

    res.status(200).json({ 
      message: "If an account exists with this email, you will receive password reset instructions.",
      success: true,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    await logAuthEvent({
      event: "PASSWORD_RESET_REQUEST",
      success: false,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
      req,
    });
    res.status(500).json({ message: "An error occurred processing your request" });
  }
}