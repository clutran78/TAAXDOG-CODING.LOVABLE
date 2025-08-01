/**
 * Environment configuration helper
 */

export const envConfig = {
  getConfig() {
    return {
      NODE_ENV: process.env.NODE_ENV || 'development',
      DATABASE_URL: process.env.DATABASE_URL || '',
      DATABASE_POOL_URL: process.env.DATABASE_POOL_URL || process.env.DATABASE_URL || '',
    };
  },

  getDatabaseUrl() {
    return process.env.DATABASE_URL || 'postgresql://localhost:5432/taaxdog';
  },

  isDevelopment() {
    return process.env.NODE_ENV !== 'production';
  },

  isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};
