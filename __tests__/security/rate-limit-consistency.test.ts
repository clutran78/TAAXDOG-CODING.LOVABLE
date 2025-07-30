import { RATE_LIMIT_CONFIGS } from '@/lib/security/rateLimiter';
import fs from 'fs';
import path from 'path';

describe('Rate Limit Configuration Consistency', () => {
  const authSystemDocPath = path.join(process.cwd(), 'docs', 'AUTHENTICATION_SYSTEM.md');
  const authTestsDocPath = path.join(process.cwd(), 'docs', 'AUTHENTICATION_TESTS.md');

  it('should have consistent rate limits between implementation and documentation', () => {
    // Check that the rate limit configuration matches expected values
    expect(RATE_LIMIT_CONFIGS.auth.login).toEqual({
      window: 15 * 60 * 1000,
      max: 5
    });

    expect(RATE_LIMIT_CONFIGS.auth.register).toEqual({
      window: 60 * 60 * 1000,
      max: 3
    });

    expect(RATE_LIMIT_CONFIGS.auth.forgotPassword).toEqual({
      window: 60 * 60 * 1000,
      max: 3
    });

    expect(RATE_LIMIT_CONFIGS.auth.resetPassword).toEqual({
      window: 60 * 60 * 1000,
      max: 5
    });
  });

  it('should have rate limits documented in AUTHENTICATION_SYSTEM.md that match implementation', () => {
    const authSystemDoc = fs.readFileSync(authSystemDocPath, 'utf-8');
    
    // Check login rate limit
    expect(authSystemDoc).toContain('Login: 5 attempts per 15 minutes');
    
    // Check registration rate limit
    expect(authSystemDoc).toContain('Registration: 3 per hour');
    
    // Check forgot password rate limit
    expect(authSystemDoc).toContain('Forgot Password: 3 per hour');
    
    // Check reset password rate limit
    expect(authSystemDoc).toContain('Reset Password: 5 per hour');
  });

  it('should have rate limits in AUTHENTICATION_TESTS.md that match implementation', () => {
    const authTestsDoc = fs.readFileSync(authTestsDocPath, 'utf-8');
    
    // Check registration rate limit test case
    expect(authTestsDoc).toContain('More than 3 registration attempts from same IP in 1 hour');
  });

  it('should not have conflicting rate limit values in documentation', () => {
    const authSystemDoc = fs.readFileSync(authSystemDocPath, 'utf-8');
    const authTestsDoc = fs.readFileSync(authTestsDocPath, 'utf-8');
    
    // Ensure no references to old incorrect values
    expect(authSystemDoc).not.toContain('Password Reset: 5 per 5 minutes');
    expect(authTestsDoc).not.toContain('More than 5 registration attempts');
  });
});