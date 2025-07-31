// Email verification configuration based on environment
export function shouldRequireEmailVerification(): boolean {
  // In development, skip email verification
  if (process.env.NODE_ENV === 'development') {
    return false;
  }

  // In production, check if email provider is properly configured
  const hasValidSendGrid =
    process.env.EMAIL_PROVIDER === 'sendgrid' &&
    process.env.SENDGRID_API_KEY &&
    process.env.SENDGRID_API_KEY.startsWith('SG.');

  const hasValidSMTP =
    process.env.EMAIL_PROVIDER === 'smtp' && process.env.SMTP_USER && process.env.SMTP_PASS;

  // Only require email verification if we have a working email provider
  return Boolean(hasValidSendGrid || hasValidSMTP);
}

export function getEmailProviderStatus(): {
  configured: boolean;
  provider: string | null;
  canSendEmails: boolean;
} {
  const hasValidSendGrid =
    process.env.EMAIL_PROVIDER === 'sendgrid' &&
    process.env.SENDGRID_API_KEY &&
    process.env.SENDGRID_API_KEY.startsWith('SG.');

  const hasValidSMTP =
    process.env.EMAIL_PROVIDER === 'smtp' && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (hasValidSendGrid) {
    return {
      configured: true,
      provider: 'sendgrid',
      canSendEmails: true,
    };
  }

  if (hasValidSMTP) {
    return {
      configured: true,
      provider: 'smtp',
      canSendEmails: true,
    };
  }

  return {
    configured: false,
    provider: process.env.EMAIL_PROVIDER || null,
    canSendEmails: false,
  };
}
