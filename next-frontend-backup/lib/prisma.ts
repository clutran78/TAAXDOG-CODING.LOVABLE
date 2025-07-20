// Re-export everything from the unified monitored Prisma client
export * from "./db/unifiedMonitoredPrisma";

// For backward compatibility, also export prisma as default
import { prisma } from "./db/unifiedMonitoredPrisma";
export default prisma;