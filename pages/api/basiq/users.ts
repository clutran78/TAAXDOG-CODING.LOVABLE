import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { basiqClient } from '@/lib/basiq/client';
import { basiqDB } from '@/lib/basiq/database';
import { CreateUserParams } from '@/lib/basiq/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  let responseStatus = 200;
  let responseBody: any = {};
  let error: string | undefined;

  try {
    switch (req.method) {
      case 'POST':
        // Create BASIQ user
        const { email, mobile, firstName, lastName } = req.body as CreateUserParams;

        // Check if user already has a BASIQ account
        const existingBasiqUser = await basiqDB.getBasiqUser(session.user.id);
        if (existingBasiqUser) {
          responseStatus = 400;
          responseBody = { error: 'BASIQ user already exists' };
          return res.status(responseStatus).json(responseBody);
        }

        // Create user in BASIQ
        const basiqUser = await basiqClient.createUser({
          email: email || session.user.email,
          mobile,
          firstName,
          lastName,
        });

        // Save to database
        await basiqDB.createBasiqUser(
          session.user.id,
          basiqUser.id,
          basiqUser.email,
          basiqUser.mobile
        );

        // Create consent for the user
        const consent = await basiqClient.createConsent(basiqUser.id, {
          purpose: 'Tax return preparation and financial analysis',
          duration: 31536000, // 1 year in seconds
          permissions: ['ACCOUNTS', 'TRANSACTIONS'],
        });

        responseBody = {
          user: basiqUser,
          consent: consent,
        };
        res.status(200).json(responseBody);
        break;

      case 'GET':
        // Get BASIQ user details
        const basiqUserRecord = await basiqDB.getBasiqUser(session.user.id);
        if (!basiqUserRecord) {
          responseStatus = 404;
          responseBody = { error: 'BASIQ user not found' };
          return res.status(responseStatus).json(responseBody);
        }

        // Fetch from BASIQ API
        const userDetails = await basiqClient.getUser(basiqUserRecord.basiq_user_id);
        
        responseBody = {
          user: userDetails,
          localData: basiqUserRecord,
        };
        res.status(200).json(responseBody);
        break;

      case 'DELETE':
        // Delete BASIQ user
        const userToDelete = await basiqDB.getBasiqUser(session.user.id);
        if (!userToDelete) {
          responseStatus = 404;
          responseBody = { error: 'BASIQ user not found' };
          return res.status(responseStatus).json(responseBody);
        }

        // Delete from BASIQ
        await basiqClient.deleteUser(userToDelete.basiq_user_id);

        // Delete from database (cascade will handle related records)
        await basiqDB.updateBasiqUserStatus(session.user.id, 'deleted');

        responseBody = { message: 'BASIQ user deleted successfully' };
        res.status(200).json(responseBody);
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
      '/api/basiq/users',
      req.method || 'GET',
      req.body,
      responseStatus,
      responseBody,
      duration,
      error
    );
  }
}