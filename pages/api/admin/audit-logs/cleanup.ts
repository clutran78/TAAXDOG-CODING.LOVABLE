import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cleanupOldAuditLogs } from '@/lib/services/auditLogger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Check if user has admin role
  if (session.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  
  try {
    // Run the cleanup job
    const deletedCount = await cleanupOldAuditLogs();
    
    return res.status(200).json({
      success: true,
      data: {
        deletedCount,
        message: `Successfully archived and deleted ${deletedCount} audit logs older than 7 years`
      }
    });
    
  } catch (error: any) {
    console.error('Audit log cleanup error:', error);
    return res.status(500).json({
      error: 'Failed to cleanup audit logs'
    });
  }
}