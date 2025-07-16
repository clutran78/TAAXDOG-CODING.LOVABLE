import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in development or with a secret token
  const token = req.headers['x-test-token'];
  if (process.env.NODE_ENV === 'production' && token !== process.env.HEALTH_CHECK_TOKEN) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const config = {
    environment: process.env.NODE_ENV,
    emailProvider: process.env.EMAIL_PROVIDER,
    sendgridConfigured: {
      apiKey: process.env.SENDGRID_API_KEY ? 'Set' : 'Not set',
      keyPrefix: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.substring(0, 7) : 'N/A',
    },
    smtpConfigured: {
      user: process.env.SMTP_USER ? 'Set' : 'Not set',
      pass: process.env.SMTP_PASS ? 'Set' : 'Not set',
      host: process.env.SMTP_HOST || 'Not set',
      port: process.env.SMTP_PORT || 'Not set',
    },
    emailFrom: process.env.EMAIL_FROM || 'Not set',
  };

  res.status(200).json(config);
}