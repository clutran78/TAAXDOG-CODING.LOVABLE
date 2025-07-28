// Re-export from the main prisma file for backward compatibility
import prisma from '../prisma';
export { prisma as unifiedMonitoredPrisma };
export { prisma as prismaClient };