import { NextApiRequest, NextApiResponse } from 'next';
import { secureAuthEndpoint } from '@/lib/middleware/security';
import { body } from 'express-validator';
import { commonValidations } from '@/lib/middleware/validation';

const handler = secureAuthEndpoint(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  // Your authentication logic here
  // This is just an example
  
  res.status(200).json({ 
    message: 'Login successful',
    user: { email }
  });
});

// Apply validation rules
export default secureAuthEndpoint(async (req: NextApiRequest, res: NextApiResponse) => {
  await handler(req, res);
});