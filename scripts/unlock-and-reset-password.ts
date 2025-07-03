import { PrismaClient } from "../generated/prisma";
import { hashPassword } from "../lib/auth";

const prisma = new PrismaClient();

async function unlockAndResetPassword() {
  const email = "a.stroe.3022@gmail.com";
  const newPassword = "password123";
  
  console.log(`Unlocking and resetting password for: ${email}`);
  
  try {
    // First, let's check the current status
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        failedLoginAttempts: true,
        lockedUntil: true
      }
    });

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log("\nCurrent status:");
    console.log(`Failed attempts: ${user.failedLoginAttempts}`);
    console.log(`Locked until: ${user.lockedUntil || "Not locked"}`);

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update user: reset password, unlock account, reset failed attempts
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null
      },
      select: {
        id: true,
        email: true,
        name: true,
        failedLoginAttempts: true,
        lockedUntil: true
      }
    });

    console.log("\n✅ Account unlocked and password reset!");
    console.log("Updated status:");
    console.log(`Failed attempts: ${updatedUser.failedLoginAttempts}`);
    console.log(`Locked until: ${updatedUser.lockedUntil || "Not locked"}`);
    
    console.log("\n📝 You can now login with:");
    console.log(`Email: ${email}`);
    console.log(`Password: ${newPassword}`);
    console.log("\n🌐 Login at any of these pages:");
    console.log("- http://localhost:3000/auth/modern-login");
    console.log("- http://localhost:3000/auth/simple-login");
    console.log("- http://localhost:3000/auth-test");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

unlockAndResetPassword();