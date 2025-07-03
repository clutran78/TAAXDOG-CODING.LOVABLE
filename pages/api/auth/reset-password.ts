import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { 
  validatePassword, 
  hashPassword, 
  verifyPasswordResetToken,
  updateUserPassword,
  logAuthEvent 
} from "../../../lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: "Password does not meet requirements",
        errors: passwordValidation.errors,
        score: passwordValidation.score,
      });
    }

    // Verify reset token
    const email = await verifyPasswordResetToken(token);
    if (!email) {
      await logAuthEvent({
        event: "PASSWORD_RESET_SUCCESS",
        success: false,
        metadata: { reason: "Invalid or expired token" },
        req,
      });
      return res.status(400).json({ 
        message: "Invalid or expired reset token. Please request a new password reset." 
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    // Check if new password is same as current password
    const bcrypt = await import("bcryptjs");
    if (user.password && await bcrypt.compare(password, user.password)) {
      return res.status(400).json({ 
        message: "New password must be different from your current password" 
      });
    }

    // Update password
    const success = await updateUserPassword(user.id, password);
    
    if (!success) {
      throw new Error("Failed to update password");
    }

    // Delete the used reset token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: email,
          token: `reset_${token}`,
        },
      },
    });

    // Log successful password reset
    await logAuthEvent({
      event: "PASSWORD_RESET_SUCCESS",
      userId: user.id,
      success: true,
      req,
    });

    res.status(200).json({ 
      message: "Password reset successfully. You can now login with your new password.",
      success: true,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    await logAuthEvent({
      event: "PASSWORD_RESET_SUCCESS",
      success: false,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
      req,
    });
    res.status(500).json({ message: "An error occurred resetting your password" });
  }
}