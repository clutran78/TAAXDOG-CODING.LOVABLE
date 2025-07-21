import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

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

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(), // Token must not be expired
        },
      },
    });

    if (!user) {
      console.log(`[ResetPassword] No user found with valid token: ${token?.substring(0, 10)}...`);
      return res.status(400).json({
        error: "Invalid token",
        message: "Password reset token is invalid or has expired",
      });
    }
    
    console.log(`[ResetPassword] Found user for password reset: ${user.email}`);

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    console.log("✅ Password reset successful for user:", user.email);

    return res.status(200).json({
      message: "Password reset successful",
    });

  } catch (error: any) {
    console.error("❌ Reset password error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred. Please try again later.",
    });
  }
}