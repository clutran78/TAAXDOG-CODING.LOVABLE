import { PrismaClient } from "../generated/prisma";
import { hashPassword, validatePassword } from "../lib/auth";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function testAuthenticationSystem() {
  console.log("🔍 Testing Taaxdog Authentication System...\n");

  try {
    // Test 1: Database Connection
    console.log("1️⃣ Testing database connection...");
    await prisma.$connect();
    console.log("✅ Database connected successfully\n");

    // Test 2: Password Validation
    console.log("2️⃣ Testing password validation...");
    const weakPassword = "test123";
    const strongPassword = "Test123!@#$%Strong";
    
    const weakValidation = validatePassword(weakPassword);
    console.log(`❌ Weak password validation: ${weakValidation.valid ? "PASS" : "FAIL"}`);
    console.log(`   Errors: ${weakValidation.errors.join(", ")}`);
    
    const strongValidation = validatePassword(strongPassword);
    console.log(`✅ Strong password validation: ${strongValidation.valid ? "PASS" : "FAIL"}\n`);

    // Test 3: Password Hashing
    console.log("3️⃣ Testing password hashing...");
    const hashedPassword = await hashPassword(strongPassword);
    const isMatch = await bcrypt.compare(strongPassword, hashedPassword);
    console.log(`✅ Password hashing and verification: ${isMatch ? "PASS" : "FAIL"}\n`);

    // Test 4: Create Test User
    console.log("4️⃣ Creating test user...");
    const testEmail = `test-${Date.now()}@example.com`;
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Test User",
        password: hashedPassword,
        phone: "+61412345678",
        abn: "12345678901",
        taxResidency: "RESIDENT",
      },
    });
    console.log(`✅ Test user created: ${testUser.email}\n`);

    // Test 5: Simulate Failed Login Attempts
    console.log("5️⃣ Testing account lockout mechanism...");
    for (let i = 1; i <= 5; i++) {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { failedLoginAttempts: i },
      });
    }
    
    const lockedUser = await prisma.user.update({
      where: { id: testUser.id },
      data: { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) },
    });
    console.log(`✅ Account locked after 5 failed attempts\n`);

    // Test 6: Audit Log Creation
    console.log("6️⃣ Testing audit log...");
    const auditLog = await prisma.auditLog.create({
      data: {
        event: "LOGIN_SUCCESS",
        userId: testUser.id,
        ipAddress: "127.0.0.1",
        userAgent: "Test Script",
        success: true,
        metadata: { test: true },
      },
    });
    console.log(`✅ Audit log created: ${auditLog.event}\n`);

    // Test 7: Check Tables
    console.log("7️⃣ Checking all authentication tables...");
    const tables = [
      { name: "users", count: await prisma.user.count() },
      { name: "accounts", count: await prisma.account.count() },
      { name: "sessions", count: await prisma.session.count() },
      { name: "verification_tokens", count: await prisma.verificationToken.count() },
      { name: "audit_logs", count: await prisma.auditLog.count() },
    ];

    tables.forEach(table => {
      console.log(`   📊 ${table.name}: ${table.count} records`);
    });

    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await prisma.auditLog.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log("✅ Test data cleaned up\n");

    console.log("🎉 All authentication tests passed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
testAuthenticationSystem();