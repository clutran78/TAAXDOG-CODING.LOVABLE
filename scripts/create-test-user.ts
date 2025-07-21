import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

async function createTestUser() {
  console.log("Creating test user for authentication testing...\n");

  const email = "test@example.com";
  const password = "Test123!@#$%";
  
  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      console.log("Test user already exists!");
      console.log("\n📧 Email: test@example.com");
      console.log("🔑 Password: Test123!@#$%");
      console.log("\n✅ You can log in at: http://localhost:3000/auth/login");
      return;
    }

    // Create new test user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name: "Test User",
        password: hashedPassword,
        phone: "+61412345678",
        abn: "12345678901",
        taxResidency: "RESIDENT",
        role: "USER"
      }
    });

    console.log("✅ Test user created successfully!");
    console.log("\n📋 Login credentials:");
    console.log("📧 Email: test@example.com");
    console.log("🔑 Password: Test123!@#$%");
    console.log("\n🌐 Login at: http://localhost:3000/auth/login");
    console.log("🧪 Test page: http://localhost:3000/test-auth");

  } catch (error) {
    console.error("Error creating test user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();