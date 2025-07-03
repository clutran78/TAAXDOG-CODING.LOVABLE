import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { bankingValidators } from '@/lib/basiq/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, value, additionalData } = req.body;

    switch (type) {
      case 'bsb':
        const bsbValidation = bankingValidators.validateBSB(value);
        if (bsbValidation.valid) {
          const bankName = bankingValidators.getBankFromBSB(value);
          res.status(200).json({
            valid: true,
            formatted: bsbValidation.formatted,
            bankName,
          });
        } else {
          res.status(400).json({
            valid: false,
            error: bsbValidation.error,
          });
        }
        break;

      case 'accountNumber':
        const accountValidation = bankingValidators.validateAccountNumber(value, additionalData?.bsb);
        if (accountValidation.valid) {
          res.status(200).json({
            valid: true,
            formatted: accountValidation.formatted,
          });
        } else {
          res.status(400).json({
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
          res.status(200).json({
            valid: true,
            formatted: bankAccountValidation.formatted,
            bankName,
          });
        } else {
          res.status(400).json({
            valid: false,
            errors: bankAccountValidation.errors,
          });
        }
        break;

      case 'mobile':
        const mobileValidation = bankingValidators.validateAustralianMobile(value);
        if (mobileValidation.valid) {
          res.status(200).json({
            valid: true,
            formatted: mobileValidation.formatted,
          });
        } else {
          res.status(400).json({
            valid: false,
            error: mobileValidation.error,
          });
        }
        break;

      case 'abn':
        const abnValidation = bankingValidators.validateABN(value);
        if (abnValidation.valid) {
          res.status(200).json({
            valid: true,
            formatted: abnValidation.formatted,
          });
        } else {
          res.status(400).json({
            valid: false,
            error: abnValidation.error,
          });
        }
        break;

      case 'tfn':
        // Note: TFN validation should be handled carefully
        const tfnValidation = bankingValidators.validateTFN(value);
        if (tfnValidation.valid) {
          res.status(200).json({
            valid: true,
            // Don't return formatted TFN for security
          });
        } else {
          res.status(400).json({
            valid: false,
            error: tfnValidation.error,
          });
        }
        break;

      default:
        res.status(400).json({ error: 'Invalid validation type' });
    }
  } catch (error: any) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Validation failed', message: error.message });
  }
}