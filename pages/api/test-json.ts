import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Body type:', typeof req.body);
  
  if (req.method === 'POST') {
    return res.status(200).json({
      received: req.body,
      bodyType: typeof req.body,
      headers: {
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length']
      }
    });
  }
  
  return res.status(200).json({ message: 'Test endpoint ready' });
}