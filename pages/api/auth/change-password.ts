import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions, validatePassword, hashPassword, logAuthEvent as logAuth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import { AuthEvent } from "../../../generated/prisma";
import { sendPasswordChangeNotification } from "../../../lib/email";

// Security configuration
const PASSWORD_HISTORY_COUNT = 5; // Number of previous passwords to check

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        message: "New password does not meet requirements",
        errors: passwordValidation.errors,
        score: passwordValidation.score,
      });
    }
    
    // Check minimum password score for existing users (higher security)
    if (passwordValidation.score < 7) {
      return res.status(400).json({
        message: "Password is not strong enough. Please use a more complex password.",
        score: passwordValidation.score,
        minScore: 7,
      });
    }

    // Get user with password and email
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, password: true },
    });

    if (!user || !user.password) {
      await logAuth({
        event: "PASSWORD_CHANGE",
        userId: session.user.id,
        success: false,
        metadata: { reason: "User not found or no password set" },
        req,
      });
      return res.status(400).json({ message: "Cannot change password for this account" });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      // Increment failed attempts for security
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      
      await logAuth({
        event: "PASSWORD_CHANGE",
        userId: session.user.id,
        success: false,
        metadata: { reason: "Invalid current password" },
        req,
      });
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Check if new password is the same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear any failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Log successful password change
    await logAuth({
      event: "PASSWORD_CHANGE",
      userId: user.id,
      success: true,
      req,
    });

    // Send email notification about password change
    try {
      await sendPasswordChangeNotification(user.email, user.name, req);
    } catch (emailError) {
      console.error("Failed to send password change notification:", emailError);
    }

    res.status(200).json({ 
      message: "Password changed successfully",
      success: true,
    });
  } catch (error) {
    console.error("Password change error:", error);
    await logAuth({
      event: "PASSWORD_CHANGE",
      userId: session.user.id,
      success: false,
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
      req,
    });
    res.status(500).json({ message: "An error occurred while changing password" });
  }
}