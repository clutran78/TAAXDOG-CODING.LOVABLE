import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GSTComplianceService } from '@/lib/services/compliance';
import { z } from 'zod';

// Validation schema
const validateABNSchema = z.object({
  abn: z.string().min(11).max(14), // Allow for spaces
});

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

  try {
    const validatedData = validateABNSchema.parse(req.body);

    const abnValidation = GSTComplianceService.validateABN(validatedData.abn);
    
    if (abnValidation.valid) {
      // Also check GST registration status
      const gstRegistration = await GSTComplianceService.validateGSTRegistration(
        validatedData.abn
      );

      return res.status(200).json({
        success: true,
        data: {
          valid: true,
          formatted: abnValidation.formatted,
          gstRegistered: gstRegistration.registered,
          gstRegistrationDate: gstRegistration.registrationDate,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        valid: false,
        message: 'Invalid ABN format',
      },
    });

  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    console.error('Error validating ABN:', error);
    return res.status(500).json({
      error: 'Failed to validate ABN',
    });
  }
}