import { NextApiRequest, NextApiResponse } from 'next';
import { secureAuthEndpoint } from '@/lib/middleware/security';
import { body } from 'express-validator';
import { commonValidations } from '@/lib/middleware/validation';
import { apiResponse } from '@/lib/api/response';

const handler = secureAuthEndpoint(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  // Your authentication logic here
  // This is just an example

  apiResponse.success(res, {
    message: 'Login successful',
    user: { email },
  });
});

// Export the already wrapped handler
export default handler;
