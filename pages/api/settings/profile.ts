import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { ApiResponse } from '../../../lib/api/response';
import { withAuth } from '../../../lib/middleware/auth';
import prisma from '../../../lib/prisma';
import { auditLogger } from '../../../lib/services/auditLogger';
import { authOptions } from '../auth/[...nextauth]';

// Australian phone number validation
const australianPhoneSchema = z.string().regex(
  /^(\+61|0)?4\d{8}$/,
  'Please enter a valid Australian mobile number'
);

// ABN validation
const abnSchema = z.string().regex(
  /^\d{11}$/,
  'ABN must be 11 digits'
);

// Profile update schema
const profileUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().refine(
    (val) => !val || val === '' || australianPhoneSchema.safeParse(val).success,
    'Invalid Australian phone number'
  ),
  abn: z.string().optional().refine(
    (val) => !val || val === '' || abnSchema.safeParse(val).success,
    'Invalid ABN format'
  ),
  businessName: z.string().optional(),
  taxFileNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.enum(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', '']).optional(),
  postcode: z.string().optional().refine(
    (val) => !val || val === '' || /^\d{4}$/.test(val),
    'Postcode must be 4 digits'
  ),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json(ApiResponse.error('Method not allowed'));
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json(ApiResponse.error('Unauthorized'));
    }

    // Validate request body
    const validationResult = profileUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json(
        ApiResponse.error(validationResult.error.errors[0].message)
      );
    }

    const {data} = validationResult;

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: data.name,
        phone: data.phone || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        postcode: data.postcode || null,
        abn: data.abn || null,
        businessName: data.businessName || null,
        taxFileNumber: data.taxFileNumber || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        postcode: true,
        abn: true,
        businessName: true,
      },
    });

    // Log the profile update
    await auditLogger.log({
      action: 'PROFILE_UPDATE',
      userId: session.user.id,
      metadata: {
        fieldsUpdated: Object.keys(data).filter(key => key !== 'email'),
      },
    });

    return res.status(200).json(ApiResponse.success({
      message: 'Profile updated successfully',
      user: updatedUser,
    }));
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json(ApiResponse.error('Failed to update profile'));
  }
}

export default withAuth(handler);