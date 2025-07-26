import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cleanupOldAuditLogs } from '@/lib/services/auditLogger';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  // Check if user has admin role
  if (session.user.role !== 'ADMIN') {
    return apiResponse.forbidden(res, { error: 'Forbidden: Admin access required' });
  }

  try {
    // Run the cleanup job
    const deletedCount = await cleanupOldAuditLogs();

    return apiResponse.success(res, {
      success: true,
      data: {
        deletedCount,
        message: `Successfully archived and deleted ${deletedCount} audit logs older than 7 years`,
      },
    });
  } catch (error: any) {
    logger.error('Audit log cleanup error:', error);
    return apiResponse.internalError(res, {
      error: 'Failed to cleanup audit logs',
    });
  }
}
