import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import { verifyPasswordResetToken, resetPassword } from "../../../lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[ResetPassword] Request received - Method: ${req.method}, Time: ${new Date().toISOString()}`);
  
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { token, password } = req.body;
    console.log(`[ResetPassword] Reset attempt with token: ${token?.substring(0, 10)}...`);

    if (!token || !password) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "Token and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Invalid password",
        message: "Password must be at least 8 characters long",
      });
    }

    // Use the new password reset token verification
    console.log(`[ResetPassword] Verifying token...`);
    const resetToken = await verifyPasswordResetToken(token);
    
    if (!resetToken) {
      console.log(`[ResetPassword] Invalid or expired token: ${token?.substring(0, 10)}...`);
      return res.status(400).json({
        error: "Invalid token",
        message: "Password reset token is invalid or has expired",
      });
    }
    
    console.log(`[ResetPassword] Token valid for email: ${resetToken.email}`);

    // Use the resetPassword function from auth.ts
    try {
      await resetPassword(token, password);
      console.log(`[ResetPassword] ✅ Password reset successful for: ${resetToken.email}`);
      
      return res.status(200).json({
        message: "Password reset successful",
        success: true
      });
    } catch (error: any) {
      console.error(`[ResetPassword] Failed to reset password:`, error);
      return res.status(500).json({
        error: "Failed to reset password",
        message: error.message || "Failed to reset password. Please try again.",
      });
    }

  } catch (error: any) {
    console.error("❌ Reset password error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred. Please try again later.",
    });
  }
}