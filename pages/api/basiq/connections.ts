import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import authOptions from '../auth/[...nextauth]';
import { basiqClient } from '@/lib/basiq/client';
import { basiqDB } from '@/lib/basiq/database';
import { CreateConnectionParams } from '@/lib/basiq/types';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  const startTime = Date.now();
  let responseStatus = 200;
  let responseBody: any = {};
  let error: string | undefined;

  try {
    // Get BASIQ user
    const basiqUser = await basiqDB.getBasiqUser(session.user.id);
    if (!basiqUser) {
      responseStatus = 404;
      responseBody = { error: 'BASIQ user not found. Please create a BASIQ user first.' };
      return res.status(responseStatus).json(responseBody);
    }

    switch (req.method) {
      case 'POST':
        // Create bank connection
        const { loginId, password, institution, securityCode } = req.body as CreateConnectionParams;

        // Validate institution
        if (!institution) {
          responseStatus = 400;
          responseBody = { error: 'Institution ID is required' };
          return res.status(responseStatus).json(responseBody);
        }

        // Create connection job
        const job = await basiqClient.createConnection(basiqUser.basiq_user_id, {
          loginId,
          password,
          institution,
          securityCode,
        });

        // Wait for job to complete
        const completedJob = await basiqClient.waitForJob(job.id);

        if (completedJob.status === 'failed') {
          responseStatus = 400;
          responseBody = {
            error: 'Connection failed',
            details: completedJob.error,
          };
          return res.status(responseStatus).json(responseBody);
        }

        // Get connection details
        const connectionId = completedJob.result?.url.split('/').pop();
        if (!connectionId) {
          throw new Error('Connection ID not found in job result');
        }

        const connection = await basiqClient.getConnection(basiqUser.basiq_user_id, connectionId);

        // Save to database
        await basiqDB.createBankConnection(
          basiqUser.basiq_user_id,
          connection.id,
          connection.institution.id,
          connection.institution.name,
          connection.status,
        );

        responseBody = {
          connection,
          job: completedJob,
        };
        apiResponse.success(res, responseBody);
        break;

      case 'GET':
        // Get all connections
        const connections = await basiqClient.getConnections(basiqUser.basiq_user_id);
        const localConnections = await basiqDB.getUserConnections(session.user.id);

        responseBody = {
          connections: connections.data,
          localData: localConnections,
        };
        apiResponse.success(res, responseBody);
        break;

      case 'PUT':
        // Refresh connection
        const { connectionId: refreshConnectionId } = req.body;
        if (!refreshConnectionId) {
          responseStatus = 400;
          responseBody = { error: 'Connection ID is required' };
          return res.status(responseStatus).json(responseBody);
        }

        const refreshJob = await basiqClient.refreshConnection({
          userId: basiqUser.basiq_user_id,
          connectionId: refreshConnectionId,
        });

        // Wait for job to complete
        const refreshedJob = await basiqClient.waitForJob(refreshJob.id);

        if (refreshedJob.status === 'completed') {
          await basiqDB.updateConnectionStatus(refreshConnectionId, 'success');
        }

        responseBody = {
          job: refreshedJob,
        };
        apiResponse.success(res, responseBody);
        break;

      case 'DELETE':
        // Delete connection
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
          responseStatus = 400;
          responseBody = { error: 'Connection ID is required' };
          return res.status(responseStatus).json(responseBody);
        }

        await basiqClient.deleteConnection(basiqUser.basiq_user_id, id);
        await basiqDB.updateConnectionStatus(id, 'deleted');

        responseBody = { message: 'Connection deleted successfully' };
        apiResponse.success(res, responseBody);
        break;

      default:
        responseStatus = 405;
        responseBody = { error: 'Method not allowed' };
        res.status(responseStatus).json(responseBody);
    }
  } catch (err: any) {
    responseStatus = 500;
    error = err.message;
    responseBody = { error: 'Internal server error', message: err.message };
    res.status(responseStatus).json(responseBody);
  } finally {
    // Log API call
    const duration = Date.now() - startTime;
    await basiqDB.logAPICall(
      session.user.id,
      '/api/basiq/connections',
      req.method || 'GET',
      req.body,
      responseStatus,
      responseBody,
      duration,
      error,
    );
  }
}
