// Re-export everything from the optimized Prisma client
export * from "./prisma-optimized";

// For backward compatibility, also export prisma as default
import { prisma } from "./prisma-optimized";
export default prisma;