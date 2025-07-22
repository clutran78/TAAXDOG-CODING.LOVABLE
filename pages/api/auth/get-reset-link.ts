import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { createPasswordResetToken } from "../../../lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development or with a secret key
  if (process.env.NODE_ENV === 'production' && !req.headers['x-admin-key']) {
    return res.status(403).json({ error: "Forbidden in production" });
  }

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
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token
    const resetToken = await createPasswordResetToken(user.email);
    const resetUrl = `${process.env.NEXTAUTH_URL || 'https://dev.taxreturnpro.com.au'}/auth/reset-password?token=${resetToken}`;

    console.log(`[GetResetLink] Generated reset link for ${email}`);

    return res.status(200).json({ 
      message: "Reset link generated",
      resetUrl,
      expiresIn: "1 hour",
      note: "This is a temporary endpoint for debugging. Copy the link and use it to reset your password."
    });

  } catch (error: any) {
    console.error("[GetResetLink] Error:", error);
    return res.status(500).json({ 
      message: "An error occurred",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}