import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  logger.info('🧪 Test registration endpoint called');

  try {
    // 1. Test Prisma connection
    logger.info('1. Testing Prisma connection...');
    await prisma.$connect();
    logger.info('✅ Prisma connected');

    // 2. Check database
    logger.info('2. Checking database...');
    const userCount = await prisma.user.count();
    logger.info(`✅ Database accessible. User count: ${userCount}`);

    // 3. Check if Prisma client is properly loaded
    logger.info('3. Checking Prisma client...');
    logger.info(`Prisma client type: ${typeof prisma}`);
    logger.info(`Has user model: ${!!prisma.user}`);

    // 4. Test bcrypt
    logger.info('4. Testing bcrypt...');
    const testHash = await bcrypt.hash('test', 12);
    const isValid = await bcrypt.compare('test', testHash);
    logger.info(`✅ Bcrypt working: ${isValid}`);

    // 5. Get user model info using Prisma's safe methods
    logger.info('5. Getting user model info...');

    // Get a sample user to see the model structure
    const sampleUser = await prisma.user.findFirst({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Get field names from Prisma's model
    const userFields = sampleUser ? Object.keys(sampleUser) : [];
    logger.info('User model fields:', userFields);

    // Return diagnostic info
    apiResponse.success(res, {
      status: 'ok',
      diagnostics: {
        prismaConnected: true,
        userCount,
        bcryptWorking: isValid,
        hasUserModel: !!prisma.user,
        environment: process.env.NODE_ENV,
        databaseUrlSet: !!process.env.DATABASE_URL,
        modelFields: userFields,
        hasSampleUser: !!sampleUser,
      },
    });
  } catch (error: any) {
    console.error('❌ Test registration error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    apiResponse.internalError(res, {
      status: 'error',
      error: {
        message: error.message,
        code: error.code,
        type: error.constructor.name,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
