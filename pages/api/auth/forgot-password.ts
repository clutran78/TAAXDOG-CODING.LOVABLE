import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import crypto from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Missing email",
        message: "Email is required",
      });
    }

    // Always return success to prevent email enumeration
    const successResponse = {
      message: "If an account exists with this email, you will receive password reset instructions.",
    };

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      console.log("Password reset requested for non-existent email:", email);
      return res.status(200).json(successResponse);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    console.log("✅ Password reset token generated for:", user.email);
    console.log("🔗 Reset link:", `${process.env.APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`);

    return res.status(200).json(successResponse);
  } catch (error: any) {
    console.error("❌ Forgot password error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred. Please try again later.",
    });
  }
}