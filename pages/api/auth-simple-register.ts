import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Simple register called');
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);

  // Simple validation
  const { email, password, name } = req.body || {};
  
  if (!email || !password || !name) {
    return res.status(400).json({
      error: 'Missing required fields',
      received: req.body
    });
  }

  // For testing, just return success
  return res.status(200).json({
    message: 'Registration test successful',
    data: { email, name }
  });
}