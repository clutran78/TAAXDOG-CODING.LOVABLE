import { NextApiRequest, NextApiResponse } from 'next';
import { withSecurity } from '@/lib/middleware/security';
import { body } from 'express-validator';

const validations = [
  body('title').notEmpty().trim().escape().isLength({ max: 200 }),
  body('description').optional().trim().escape().isLength({ max: 1000 }),
  body('targetAmount').isFloat({ min: 0 }).toFloat(),
  body('targetDate').isISO8601().toDate(),
];

export default withSecurity(async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, description, targetAmount, targetDate } = req.body;
  const user = (req as any).user;

  // Your goal creation logic here
  // This is just an example
  
  res.status(201).json({ 
    message: 'Goal created successfully',
    goal: {
      id: 'example-id',
      title,
      description,
      targetAmount,
      targetDate,
      userId: user.id
    }
  });
}, { 
  rateLimit: 'goals',
  validations,
  allowedMethods: ['POST']
});