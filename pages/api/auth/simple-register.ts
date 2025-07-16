import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { hashPassword, createVerificationToken } from "../../../lib/auth";
import { sendVerificationEmail } from "../../../lib/email";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const startTime = Date.now();
  console.log("[Register] Starting registration process for:", req.body.email);

  try {
    const { email, password, name } = req.body;

    // Basic validation
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Check if user exists with enhanced error logging
    console.log("[Register] Checking if user exists:", email);
    let existingUser;
    try {
      existingUser = await prisma.user.findUnique({
        where: { email },
      });
      console.log("[Register] User check completed:", existingUser ? "exists" : "not found");
    } catch (dbError) {
      console.error("[Register] Database error during user check:", {
        error: dbError.message,
        code: dbError.code,
        email
      });
      throw dbError;
    }

    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Create user with minimal fields and enhanced error handling
    console.log("[Register] Hashing password...");
    const hashedPassword = await hashPassword(password);
    
    console.log("[Register] Creating user in database...");
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          taxResidency: "RESIDENT", // Default value
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });
      console.log("[Register] User created successfully:", user.id);
    } catch (createError) {
      console.error("[Register] Failed to create user:", {
        error: createError.message,
        code: createError.code,
        detail: createError.meta,
        email
      });
      
      // Check for specific constraint violations
      if (createError.code === "P2002") {
        return res.status(409).json({ 
          message: "Email already registered. Please try logging in instead.",
          code: "EMAIL_EXISTS"
        });
      }
      
      throw createError;
    }

    // Try to send verification email, but don't fail registration if email fails
    try {
      const verificationToken = await createVerificationToken(email);
      await sendVerificationEmail(email, name, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Continue with registration success even if email fails
    }

    res.status(201).json({
      message: "Account created successfully. Please check your email for verification.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[Register] Registration failed:", {
      error: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      duration: `${duration}ms`,
      email: req.body.email
    });
    
    // Return user-friendly error messages
    if (error.code === "P2002") {
      return res.status(409).json({ 
        message: "This email is already registered. Please try logging in.",
        code: "EMAIL_EXISTS"
      });
    }
    
    if (error.code === "P1001" || error.code === "P1002") {
      return res.status(503).json({ 
        message: "Database connection error. Please try again in a moment.",
        code: "DB_CONNECTION_ERROR"
      });
    }
    
    res.status(500).json({ 
      message: "An error occurred during registration. Please try again.",
      code: "REGISTRATION_ERROR"
    });
  } finally {
    const duration = Date.now() - startTime;
    console.log(`[Register] Request completed in ${duration}ms`);
  }
}