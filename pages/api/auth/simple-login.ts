import type { NextApiRequest, NextApiResponse } from "next";
import { signIn } from "next-auth/react";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        emailVerified: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    if (!user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if email is verified (only if email provider is configured)
    const { shouldRequireEmailVerification } = await import('../../../lib/auth/email-config');
    if (shouldRequireEmailVerification() && !user.emailVerified) {
      return res.status(403).json({ 
        message: "Please verify your email before logging in",
        requiresVerification: true 
      });
    }

    // Return success with user data
    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

  } catch (error: any) {
    console.error("[SimpleLogin] Error:", error);
    return res.status(500).json({ 
      message: "An error occurred during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}