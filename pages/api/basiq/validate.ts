import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { bankingValidators } from '@/lib/basiq/validation';
import { logger } from '@/lib/logger';
import { apiResponse } from '@/lib/api/response';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return apiResponse.unauthorized(res, { error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return apiResponse.methodNotAllowed(res, { error: 'Method not allowed' });
  }

  try {
    const { type, value, additionalData } = req.body;

    switch (type) {
      case 'bsb':
        const bsbValidation = bankingValidators.validateBSB(value);
        if (bsbValidation.valid) {
          const bankName = bankingValidators.getBankFromBSB(value);
          apiResponse.success(res, {
            valid: true,
            formatted: bsbValidation.formatted,
            bankName,
          });
        } else {
          apiResponse.error(res, {
            valid: false,
            error: bsbValidation.error,
          });
        }
        break;

      case 'accountNumber':
        const accountValidation = bankingValidators.validateAccountNumber(
          value,
          additionalData?.bsb,
        );
        if (accountValidation.valid) {
          apiResponse.success(res, {
            valid: true,
            formatted: accountValidation.formatted,
          });
        } else {
          apiResponse.error(res, {
            valid: false,
            error: accountValidation.error,
          });
        }
        break;

      case 'bankAccount':
        const { bsb, accountNumber, accountName } = value;
        const bankAccountValidation = bankingValidators.validateBankAccount({
          bsb,
          accountNumber,
          accountName,
        });

        if (bankAccountValidation.valid) {
          const bankName = bankingValidators.getBankFromBSB(bsb);
          apiResponse.success(res, {
            valid: true,
            formatted: bankAccountValidation.formatted,
            bankName,
          });
        } else {
          apiResponse.error(res, {
            valid: false,
            errors: bankAccountValidation.errors,
          });
        }
        break;

      case 'mobile':
        const mobileValidation = bankingValidators.validateAustralianMobile(value);
        if (mobileValidation.valid) {
          apiResponse.success(res, {
            valid: true,
            formatted: mobileValidation.formatted,
          });
        } else {
          apiResponse.error(res, {
            valid: false,
            error: mobileValidation.error,
          });
        }
        break;

      case 'abn':
        const abnValidation = bankingValidators.validateABN(value);
        if (abnValidation.valid) {
          apiResponse.success(res, {
            valid: true,
            formatted: abnValidation.formatted,
          });
        } else {
          apiResponse.error(res, {
            valid: false,
            error: abnValidation.error,
          });
        }
        break;

      case 'tfn':
        // Note: TFN validation should be handled carefully
        const tfnValidation = bankingValidators.validateTFN(value);
        if (tfnValidation.valid) {
          apiResponse.success(res, {
            valid: true,
            // Don't return formatted TFN for security
          });
        } else {
          apiResponse.error(res, {
            valid: false,
            error: tfnValidation.error,
          });
        }
        break;

      default:
        apiResponse.error(res, { error: 'Invalid validation type' });
    }
  } catch (error: any) {
    logger.error('Validation error:', error);
    apiResponse.internalError(res, { error: 'Validation failed', message: error.message });
  }
}
