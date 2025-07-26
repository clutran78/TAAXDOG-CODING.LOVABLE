import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { basiqClient } from '@/lib/basiq/client';
import { basiqDB } from '@/lib/basiq/database';
import { BASIQ_CONFIG } from '@/lib/basiq/config';
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
    switch (req.method) {
      case 'GET':
        const { id, country = 'AU' } = req.query;

        if (id && typeof id === 'string') {
          // Get specific institution
          const institution = await basiqClient.getInstitution(id);
          responseBody = { institution };
        } else {
          // Get all institutions
          const institutions = await basiqClient.getInstitutions();

          // Filter Australian institutions
          const australianInstitutions = institutions.data.filter(
            (inst) => inst.country === country,
          );

          // Add popular flag for major Australian banks
          const popularIds = Object.values(BASIQ_CONFIG.INSTITUTIONS);
          const institutionsWithPopular = australianInstitutions.map((inst) => ({
            ...inst,
            isPopular: popularIds.includes(inst.id),
          }));

          // Sort by popular first, then alphabetically
          institutionsWithPopular.sort((a, b) => {
            if (a.isPopular && !b.isPopular) return -1;
            if (!a.isPopular && b.isPopular) return 1;
            return a.name.localeCompare(b.name);
          });

          responseBody = {
            institutions: institutionsWithPopular,
            count: institutionsWithPopular.length,
          };
        }

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
      '/api/basiq/institutions',
      req.method || 'GET',
      req.body,
      responseStatus,
      responseBody,
      duration,
      error,
    );
  }
}
