import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { createPasswordResetToken } from "../../../lib/auth";
import { sendPasswordResetEmail } from "../../../lib/email";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Always return success to prevent email enumeration
    const successMessage = "If an account exists with this email, you will receive password reset instructions.";

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    });

    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({ message: successMessage });
    }

    // For testing, we'll skip email verification check
    // In production, uncomment this:
    // if (!user.emailVerified) {
    //   return res.status(200).json({ message: successMessage });
    // }

    // Generate reset token
    const resetToken = await createPasswordResetToken(user.email);

    // Try to send email
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
      console.log("[ForgotPassword] ✅ Reset email sent successfully to:", user.email);
    } catch (emailError: any) {
      console.error("[ForgotPassword] ❌ Failed to send email:", {
        error: emailError.message,
        code: emailError.code,
        response: emailError.response?.body,
        to: user.email,
        stack: emailError.stack
      });
      
      // In production, we still return success to prevent email enumeration
      // but log the full error for debugging
      if (process.env.NODE_ENV === "development") {
        return res.status(500).json({ 
          message: "Failed to send reset email",
          error: emailError.message 
        });
      }
    }

    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://taxreturnpro.com.au';
    
    return res.status(200).json({ 
      message: successMessage,
      // Include token in development for testing
      debug: process.env.NODE_ENV === "development" ? {
        resetToken,
        resetUrl: `${baseUrl}/auth/reset-password?token=${resetToken}`
      } : undefined
    });

  } catch (error: any) {
    console.error("[ForgotPassword] Error:", error);
    return res.status(500).json({ 
      message: "An error occurred processing your request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}