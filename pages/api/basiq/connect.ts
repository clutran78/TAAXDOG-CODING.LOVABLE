import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { basiqClient } from '@/lib/basiq/client';
import { basiqDB } from '@/lib/basiq/database';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  let responseStatus = 200;
  let responseBody: any = {};
  let error: string | undefined;

  try {
    const { institutionId } = req.body;

    if (!institutionId) {
      responseStatus = 400;
      responseBody = { error: 'Institution ID is required' };
      return res.status(responseStatus).json(responseBody);
    }

    // Get or create BASIQ user
    let basiqUser = await basiqDB.getBasiqUser(session.user.id);
    
    if (!basiqUser) {
      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, name: true, phone: true },
      });

      if (!user) {
        responseStatus = 404;
        responseBody = { error: 'User not found' };
        return res.status(responseStatus).json(responseBody);
      }

      // Create BASIQ user
      const basiqUserResponse = await basiqClient.createUser({
        email: user.email,
        mobile: user.phone || undefined,
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' ') || undefined,
      });

      // Save to database
      basiqUser = await prisma.basiq_users.create({
        data: {
          user_id: session.user.id,
          basiq_user_id: basiqUserResponse.id,
          email: user.email,
          mobile: user.phone,
          connection_status: 'active',
        },
      });
    }

    // Create consent for the connection
    const consent = await basiqClient.createConsent(basiqUser.basiq_user_id, {
      purpose: 'Tax management and financial insights for TaxReturnPro',
      duration: 31536000, // 365 days in seconds
      permissions: ['ACCOUNTS', 'TRANSACTIONS'],
    });

    // Update consent in database
    await prisma.basiq_users.update({
      where: { id: basiqUser.id },
      data: {
        consent_id: consent.id,
        consent_status: consent.status,
        consent_expires_at: new Date(consent.expiresAt),
        updated_at: new Date(),
      },
    });

    // Get institution details
    const institution = await basiqClient.getInstitution(institutionId);

    // Generate connection URL or return connection details
    responseBody = {
      success: true,
      basiqUserId: basiqUser.basiq_user_id,
      consent: {
        id: consent.id,
        status: consent.status,
        expiresAt: consent.expiresAt,
      },
      institution: {
        id: institution.id,
        name: institution.name,
        shortName: institution.shortName,
        logo: institution.logo,
        loginIdCaption: institution.loginIdCaption,
        passwordCaption: institution.passwordCaption,
        features: institution.features,
      },
      nextStep: 'Use the connection endpoint to provide credentials',
    };

    res.status(200).json(responseBody);

  } catch (err: any) {
    responseStatus = 500;
    error = err.message;
    responseBody = { error: 'Connection initiation failed', message: err.message };
    res.status(responseStatus).json(responseBody);
  } finally {
    // Log API call
    const duration = Date.now() - startTime;
    await basiqDB.logAPICall(
      session.user.id,
      '/api/basiq/connect',
      req.method || 'POST',
      req.body,
      responseStatus,
      responseBody,
      duration,
      error
    );
  }
}