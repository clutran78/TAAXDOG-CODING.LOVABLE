import { NextApiRequest, NextApiResponse } from 'next';
import { withSecurity } from '@/lib/middleware/security';
import { body } from 'express-validator';

const validations = [
  body('imageData').notEmpty().isBase64(),
  body('category').optional().isIn(['food', 'transport', 'utilities', 'medical', 'other']),
];

export default withSecurity(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageData, category } = req.body;
  const user = (req as any).user;

  // Your receipt processing logic here
  // This is just an example
  
  res.status(200).json({ 
    message: 'Receipt processed successfully',
    receipt: {
      id: 'example-id',
      userId: user.id,
      category,
      processedAt: new Date().toISOString()
    }
  });
}, { 
  rateLimit: 'receipts',
  validations,
  allowedMethods: ['POST']
});