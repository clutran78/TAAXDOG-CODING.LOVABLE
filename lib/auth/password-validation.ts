import { z } from 'zod';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// Australian Government ISM (Information Security Manual) password requirements
const ISM_MIN_LENGTH = 13; // ISM recommends 13+ characters for high-security systems
const ISM_COMPLEXITY_POINTS = 3; // Must meet at least 3 of 4 complexity requirements
const STANDARD_MIN_LENGTH = 8; // Standard minimum for regular users
const MAX_LENGTH = 128; // Maximum password length

// Common weak passwords (Australian context included)
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password123', '123456', '123456789', '12345678', '12345',
  'qwerty', 'qwertyuiop', 'abc123', 'welcome', 'admin', 'letmein', 'monkey', 'dragon',
  'football', 'baseball', 'trustno1', 'superman', 'michael', 'shadow',
  // Australian specific
  'australia', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide',
  'canberra', 'hobart', 'darwin', 'aussie', 'straya', 'downunder',
  'kangaroo', 'koala', 'cricket', 'footy', 'rugby', 'anzac',
  // Tax/business related
  'taxreturn', 'taaxdog', 'mytax', 'taxtime', 'deduction', 'refund',
]);

// Password strength levels
export enum PasswordStrength {
  VERY_WEAK = 0,
  WEAK = 1,
  FAIR = 2,
  GOOD = 3,
  STRONG = 4,
  VERY_STRONG = 5,
}

// Password validation result interface
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  score: number;
  feedback: string[];
  suggestions: string[];
  meetsAustralianStandards: boolean;
  complexityPoints: number;
  estimatedCrackTime: string;
}

// Character class checkers
const hasUpperCase = (str: string): boolean => /[A-Z]/.test(str);
const hasLowerCase = (str: string): boolean => /[a-z]/.test(str);
const hasNumbers = (str: string): boolean => /[0-9]/.test(str);
const hasSpecialChars = (str: string): boolean => /[^A-Za-z0-9]/.test(str);
const hasSpaces = (str: string): boolean => /\s/.test(str);

// Pattern detection
const hasRepeatingChars = (str: string): boolean => /(.)\1{2,}/.test(str);
const hasSequentialChars = (str: string): boolean => {
  const sequences = ['abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij', 'ijk',
    'jkl', 'klm', 'lmn', 'mno', 'nop', 'opq', 'pqr', 'qrs', 'rst',
    'stu', 'tuv', 'uvw', 'vwx', 'wxy', 'xyz', '012', '123', '234',
    '345', '456', '567', '678', '789'];
  const lowerStr = str.toLowerCase();
  return sequences.some(seq => lowerStr.includes(seq) || lowerStr.includes(seq.split('').reverse().join('')));
};
const hasKeyboardPatterns = (str: string): boolean => {
  const patterns = ['qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', 'zaq1', '1qaz'];
  const lowerStr = str.toLowerCase();
  return patterns.some(pattern => lowerStr.includes(pattern));
};

// Calculate password entropy
function calculateEntropy(password: string): number {
  let charset = 0;
  if (hasLowerCase(password)) charset += 26;
  if (hasUpperCase(password)) charset += 26;
  if (hasNumbers(password)) charset += 10;
  if (hasSpecialChars(password)) charset += 32;
  
  return password.length * Math.log2(charset);
}

// Estimate crack time based on entropy
function estimateCrackTime(entropy: number): string {
  // Assuming 1 trillion guesses per second (modern GPU cluster)
  const guessesPerSecond = 1e12;
  const seconds = Math.pow(2, entropy) / guessesPerSecond;
  
  if (seconds < 1) return 'instant';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
  if (seconds < 3153600000) return `${Math.round(seconds / 31536000)} years`;
  
  return 'centuries';
}

// Main password validation function
export function validatePassword(
  password: string,
  options: {
    username?: string;
    email?: string;
    previousPasswords?: string[];
    requireAustralianCompliance?: boolean;
  } = {}
): PasswordValidationResult {
  const feedback: string[] = [];
  const suggestions: string[] = [];
  let score = 100; // Start with perfect score
  
  // Basic length check
  if (password.length === 0) {
    return {
      isValid: false,
      strength: PasswordStrength.VERY_WEAK,
      score: 0,
      feedback: ['Password is required'],
      suggestions: ['Enter a password'],
      meetsAustralianStandards: false,
      complexityPoints: 0,
      estimatedCrackTime: 'instant',
    };
  }
  
  if (password.length < STANDARD_MIN_LENGTH) {
    feedback.push(`Password must be at least ${STANDARD_MIN_LENGTH} characters`);
    score -= 40;
  } else if (password.length < 12) {
    suggestions.push('Consider using a longer password for better security');
    score -= 10;
  }
  
  if (password.length > MAX_LENGTH) {
    feedback.push(`Password must not exceed ${MAX_LENGTH} characters`);
    score -= 20;
  }
  
  // Character class checks
  const complexityChecks = {
    uppercase: hasUpperCase(password),
    lowercase: hasLowerCase(password),
    numbers: hasNumbers(password),
    special: hasSpecialChars(password),
  };
  
  const complexityPoints = Object.values(complexityChecks).filter(Boolean).length;
  
  if (!complexityChecks.uppercase) {
    feedback.push('Password must contain at least one uppercase letter');
    score -= 10;
  }
  
  if (!complexityChecks.lowercase) {
    feedback.push('Password must contain at least one lowercase letter');
    score -= 10;
  }
  
  if (!complexityChecks.numbers) {
    feedback.push('Password must contain at least one number');
    score -= 10;
  }
  
  if (!complexityChecks.special) {
    feedback.push('Password must contain at least one special character');
    score -= 10;
  }
  
  // Pattern detection
  if (hasRepeatingChars(password)) {
    feedback.push('Avoid repeating characters (e.g., aaa, 111)');
    score -= 15;
  }
  
  if (hasSequentialChars(password)) {
    feedback.push('Avoid sequential characters (e.g., abc, 123)');
    score -= 15;
  }
  
  if (hasKeyboardPatterns(password)) {
    feedback.push('Avoid keyboard patterns (e.g., qwerty, asdf)');
    score -= 20;
  }
  
  // Common password check
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    feedback.push('This is a commonly used password');
    suggestions.push('Choose a unique password that isn\'t easily guessable');
    score -= 50;
  }
  
  // Personal information check
  if (options.username && password.toLowerCase().includes(options.username.toLowerCase())) {
    feedback.push('Password should not contain your username');
    score -= 20;
  }
  
  if (options.email) {
    const emailPrefix = options.email.split('@')[0];
    if (password.toLowerCase().includes(emailPrefix.toLowerCase())) {
      feedback.push('Password should not contain parts of your email');
      score -= 20;
    }
  }
  
  // Previous password check
  if (options.previousPasswords?.length) {
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const isReused = options.previousPasswords.some(prevHash => 
      crypto.timingSafeEqual(Buffer.from(hashedPassword), Buffer.from(prevHash))
    );
    
    if (isReused) {
      feedback.push('Password has been used before');
      suggestions.push('Choose a password you haven\'t used previously');
      score -= 30;
    }
  }
  
  // Australian compliance check
  let meetsAustralianStandards = true;
  if (options.requireAustralianCompliance) {
    if (password.length < ISM_MIN_LENGTH) {
      feedback.push(`Australian ISM recommends at least ${ISM_MIN_LENGTH} characters for financial systems`);
      meetsAustralianStandards = false;
      score -= 10;
    }
    
    if (complexityPoints < ISM_COMPLEXITY_POINTS) {
      feedback.push(`Must meet at least ${ISM_COMPLEXITY_POINTS} of 4 complexity requirements (Australian ISM)`);
      meetsAustralianStandards = false;
      score -= 10;
    }
  }
  
  // Calculate entropy and crack time
  const entropy = calculateEntropy(password);
  const estimatedCrackTime = estimateCrackTime(entropy);
  
  // Adjust score based on entropy
  if (entropy < 35) score -= 20;
  else if (entropy < 50) score -= 10;
  else if (entropy > 70) score += 10;
  
  // Generate suggestions based on feedback
  if (password.length < 12 && suggestions.length === 0) {
    suggestions.push('Use a passphrase with 4 or more random words');
  }
  
  if (complexityPoints < 3) {
    suggestions.push('Mix uppercase, lowercase, numbers, and special characters');
  }
  
  if (score > 60 && feedback.length === 0) {
    suggestions.push('Consider using a password manager to generate and store complex passwords');
  }
  
  // Calculate final strength
  const finalScore = Math.max(0, Math.min(100, score));
  let strength: PasswordStrength;
  
  if (finalScore >= 90) strength = PasswordStrength.VERY_STRONG;
  else if (finalScore >= 75) strength = PasswordStrength.STRONG;
  else if (finalScore >= 60) strength = PasswordStrength.GOOD;
  else if (finalScore >= 45) strength = PasswordStrength.FAIR;
  else if (finalScore >= 30) strength = PasswordStrength.WEAK;
  else strength = PasswordStrength.VERY_WEAK;
  
  // Log validation attempt for security monitoring
  logger.debug('Password validation performed', {
    strength,
    score: finalScore,
    complexityPoints,
    meetsAustralianStandards,
    hasUsername: !!options.username,
    hasEmail: !!options.email,
  });
  
  return {
    isValid: feedback.length === 0,
    strength,
    score: finalScore,
    feedback,
    suggestions,
    meetsAustralianStandards,
    complexityPoints,
    estimatedCrackTime,
  };
}

// Zod schema for password with Australian compliance
export const australianCompliantPasswordSchema = z
  .string()
  .min(ISM_MIN_LENGTH, `Password must be at least ${ISM_MIN_LENGTH} characters (Australian ISM requirement)`)
  .max(MAX_LENGTH, `Password must not exceed ${MAX_LENGTH} characters`)
  .refine((password) => {
    const result = validatePassword(password, { requireAustralianCompliance: true });
    return result.meetsAustralianStandards;
  }, {
    message: 'Password does not meet Australian security standards',
  });

// Standard password schema
export const standardPasswordSchema = z
  .string()
  .min(STANDARD_MIN_LENGTH, `Password must be at least ${STANDARD_MIN_LENGTH} characters`)
  .max(MAX_LENGTH, `Password must not exceed ${MAX_LENGTH} characters`)
  .refine((password) => hasUpperCase(password), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((password) => hasLowerCase(password), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((password) => hasNumbers(password), {
    message: 'Password must contain at least one number',
  })
  .refine((password) => hasSpecialChars(password), {
    message: 'Password must contain at least one special character',
  });

// Password strength component helper
export function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VERY_WEAK:
      return '#dc2626'; // red-600
    case PasswordStrength.WEAK:
      return '#ea580c'; // orange-600
    case PasswordStrength.FAIR:
      return '#ca8a04'; // yellow-600
    case PasswordStrength.GOOD:
      return '#65a30d'; // lime-600
    case PasswordStrength.STRONG:
      return '#16a34a'; // green-600
    case PasswordStrength.VERY_STRONG:
      return '#059669'; // emerald-600
    default:
      return '#6b7280'; // gray-500
  }
}

export function getPasswordStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VERY_WEAK:
      return 'Very Weak';
    case PasswordStrength.WEAK:
      return 'Weak';
    case PasswordStrength.FAIR:
      return 'Fair';
    case PasswordStrength.GOOD:
      return 'Good';
    case PasswordStrength.STRONG:
      return 'Strong';
    case PasswordStrength.VERY_STRONG:
      return 'Very Strong';
    default:
      return 'Unknown';
  }
}

// Generate secure password
export function generateSecurePassword(
  length: number = 16,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSpecial?: boolean;
    excludeSimilar?: boolean;
    excludeAmbiguous?: boolean;
  } = {}
): string {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSpecial = true,
    excludeSimilar = true,
    excludeAmbiguous = true,
  } = options;
  
  let charset = '';
  
  if (includeLowercase) {
    charset += excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (includeUppercase) {
    charset += excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (includeNumbers) {
    charset += excludeSimilar ? '23456789' : '0123456789';
  }
  
  if (includeSpecial) {
    charset += excludeAmbiguous ? '!@#$%^&*-_=+?' : '!@#$%^&*(){}[]|\\:;"\'<>,.?/~`-_=+';
  }
  
  if (charset.length === 0) {
    throw new Error('At least one character type must be included');
  }
  
  let password = '';
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  
  // Ensure the password meets all selected criteria
  const checks = [
    { enabled: includeLowercase, test: hasLowerCase },
    { enabled: includeUppercase, test: hasUpperCase },
    { enabled: includeNumbers, test: hasNumbers },
    { enabled: includeSpecial, test: hasSpecialChars },
  ];
  
  for (const check of checks) {
    if (check.enabled && !check.test(password)) {
      // Regenerate if criteria not met
      return generateSecurePassword(length, options);
    }
  }
  
  return password;
}

// Password history management
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function isPasswordInHistory(
  password: string,
  passwordHistory: string[]
): boolean {
  const hashedPassword = hashPassword(password);
  return passwordHistory.some(hash => 
    crypto.timingSafeEqual(Buffer.from(hashedPassword), Buffer.from(hash))
  );
}

// React component helper for password requirements
export interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
  met: boolean;
}

export function getPasswordRequirements(
  password: string,
  requireAustralianCompliance: boolean = false
): PasswordRequirement[] {
  const minLength = requireAustralianCompliance ? ISM_MIN_LENGTH : STANDARD_MIN_LENGTH;
  
  return [
    {
      label: `At least ${minLength} characters`,
      test: (pwd: string) => pwd.length >= minLength,
      met: password.length >= minLength,
    },
    {
      label: 'Contains uppercase letter (A-Z)',
      test: hasUpperCase,
      met: hasUpperCase(password),
    },
    {
      label: 'Contains lowercase letter (a-z)',
      test: hasLowerCase,
      met: hasLowerCase(password),
    },
    {
      label: 'Contains number (0-9)',
      test: hasNumbers,
      met: hasNumbers(password),
    },
    {
      label: 'Contains special character',
      test: hasSpecialChars,
      met: hasSpecialChars(password),
    },
    {
      label: 'No common patterns',
      test: (pwd: string) => !hasSequentialChars(pwd) && !hasKeyboardPatterns(pwd),
      met: !hasSequentialChars(password) && !hasKeyboardPatterns(password),
    },
  ];
}