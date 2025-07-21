import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("🧪 Test registration endpoint called");

  try {
    // 1. Test Prisma connection
    console.log("1. Testing Prisma connection...");
    await prisma.$connect();
    console.log("✅ Prisma connected");

    // 2. Check database
    console.log("2. Checking database...");
    const userCount = await prisma.user.count();
    console.log(`✅ Database accessible. User count: ${userCount}`);

    // 3. Check if Prisma client is properly loaded
    console.log("3. Checking Prisma client...");
    console.log(`Prisma client type: ${typeof prisma}`);
    console.log(`Has user model: ${!!prisma.user}`);

    // 4. Test bcrypt
    console.log("4. Testing bcrypt...");
    const testHash = await bcrypt.hash("test", 12);
    const isValid = await bcrypt.compare("test", testHash);
    console.log(`✅ Bcrypt working: ${isValid}`);

    // 5. Get schema info
    console.log("5. Getting schema info...");
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      LIMIT 10;
    `;
    console.log("User table columns:", columns);

    // Return diagnostic info
    res.status(200).json({
      status: "ok",
      diagnostics: {
        prismaConnected: true,
        userCount,
        bcryptWorking: isValid,
        hasUserModel: !!prisma.user,
        environment: process.env.NODE_ENV,
        databaseUrlSet: !!process.env.DATABASE_URL,
        columns: columns
      }
    });

  } catch (error: any) {
    console.error("❌ Test registration error:", {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    res.status(500).json({
      status: "error",
      error: {
        message: error.message,
        code: error.code,
        type: error.constructor.name
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}