import { logger } from '../logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export class EmailService {
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // TODO: Implement actual email sending logic
      logger.info('Email sent', { to: options.to, subject: options.subject });
      return true;
    } catch (error) {
      logger.error('Failed to send email', { error, options });
      return false;
    }
  }

  static async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verificationUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${token}`;
    
    return this.sendEmail({
      to: email,
      subject: 'Verify your email address',
      html: `
        <h1>Verify your email</h1>
        <p>Click the link below to verify your email address:</p>
        <a href="${verificationUrl}">Verify Email</a>
      `,
      text: `Verify your email by visiting: ${verificationUrl}`,
    });
  }
}

export const { sendEmail, sendVerificationEmail } = EmailService;