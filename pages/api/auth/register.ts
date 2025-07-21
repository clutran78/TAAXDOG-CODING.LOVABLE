import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("📝 Registration request received:", {
    method: req.method,
    email: req.body?.email,
    hasPassword: !!req.body?.password,
    hasName: !!req.body?.name,
    timestamp: new Date().toISOString()
  });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password, name } = req.body;

    // Basic validation
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: "Missing required fields",
        message: "Email, password, and name are required" 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Invalid password",
        message: "Password must be at least 8 characters long"
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        error: "User already exists",
        message: "An account with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        emailVerified: new Date(), // Auto-verify for now
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    console.log("✅ User registered successfully:", user.email);

    res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("❌ Registration error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      meta: error.meta,
      email: req.body.email,
      timestamp: new Date().toISOString()
    });
    
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: "User already exists",
        message: "An account with this email already exists",
      });
    }

    if (error.code === 'P2025') {
      console.error("Database schema issue - required fields might be missing");
      return res.status(500).json({
        error: "Database configuration error",
        message: "Unable to create account due to database configuration. Please contact support.",
      });
    }

    if (error.message?.includes('prisma') || error.message?.includes('database')) {
      console.error("Database connection error during registration");
      return res.status(500).json({
        error: "Database connection error",
        message: "Unable to connect to database. Please try again later.",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to create account. Please try again.",
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}