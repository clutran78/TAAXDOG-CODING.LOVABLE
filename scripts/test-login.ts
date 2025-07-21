import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function testLogin() {
  const email = "a.stroe.3022@gmail.com";
  const testPassword = "Test123!@#$%"; // Try with the original password format
  
  console.log("Testing login for:", email);
  
  try {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        lockedUntil: true,
        failedLoginAttempts: true
      }
    });

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("✅ User found:", {
      id: user.id,
      email: user.email,
      name: user.name,
      hasPassword: !!user.password,
      lockedUntil: user.lockedUntil,
      failedAttempts: user.failedLoginAttempts
    });

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      console.log("❌ Account is locked until:", user.lockedUntil);
      return;
    }

    // Test password
    if (user.password) {
      const isValid = await bcrypt.compare(testPassword, user.password);
      console.log(`\nPassword test result:`, isValid ? "✅ VALID" : "❌ INVALID");
      
      // Try with simpler password
      const simplePassword = "password123";
      const isSimpleValid = await bcrypt.compare(simplePassword, user.password);
      console.log(`Simple password test result:`, isSimpleValid ? "✅ VALID" : "❌ INVALID");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();