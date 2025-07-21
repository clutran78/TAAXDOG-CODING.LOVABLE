import type { NextApiRequest, NextApiResponse } from "next";
import { signIn } from "next-auth/react";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log(`[SimpleLogin] Request received - Method: ${req.method}, Time: ${new Date().toISOString()}`);
  
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { email, password } = req.body;
    console.log(`[SimpleLogin] Login attempt for email: ${email}`);

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
      console.log(`[SimpleLogin] User not found for email: ${email}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    if (!user.password) {
      console.log(`[SimpleLogin] User has no password set: ${email}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`[SimpleLogin] Password validation result for ${email}: ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      console.log(`[SimpleLogin] Invalid password for user: ${email}`);
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
    console.log(`[SimpleLogin] Login successful for user: ${email}`);
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
    console.error("[SimpleLogin] Error:", {
      message: error.message,
      stack: error.stack,
      email: req.body?.email,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({ 
      message: "An error occurred during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}