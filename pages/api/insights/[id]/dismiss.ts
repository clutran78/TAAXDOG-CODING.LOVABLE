import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid insight ID' });
  }

  try {
    const insight = await prisma.financialInsight.findUnique({
      where: { id },
    });

    if (!insight) {
      return res.status(404).json({ error: 'Insight not found' });
    }

    if (insight.userId !== session.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Mark insight as inactive
    await prisma.financialInsight.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Dismiss insight error:', error);
    res.status(500).json({ error: 'Failed to dismiss insight' });
  } finally {
    await prisma.$disconnect();
  }
}