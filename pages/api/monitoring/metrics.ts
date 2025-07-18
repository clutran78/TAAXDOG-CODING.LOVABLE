import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { DatabaseMonitor } from '@/lib/monitoring/database';
import { ApiMonitor } from '@/lib/monitoring/api';
import { ApplicationMonitor } from '@/lib/monitoring/application';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if user is authenticated and is admin
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get metrics from all monitors
    const dbMonitor = DatabaseMonitor.getInstance();
    const apiMonitor = ApiMonitor.getInstance();
    const appMonitor = ApplicationMonitor.getInstance();

    const metrics = {
      database: dbMonitor.getMetrics(),
      api: apiMonitor.getMetrics(),
      application: appMonitor.getMetrics(),
      timestamp: new Date()
    };

    return res.status(200).json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return res.status(500).json({ error: 'Failed to fetch metrics' });
  }
}