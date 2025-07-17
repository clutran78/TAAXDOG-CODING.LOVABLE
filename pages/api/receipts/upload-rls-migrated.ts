import type { NextApiResponse } from 'next';
import { withRLSMiddleware, NextApiRequestWithRLS, handleRLSError } from '@/lib/middleware/rls-middleware';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

async function handler(req: NextApiRequestWithRLS, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'receipts');
    await fs.mkdir(uploadDir, { recursive: true });

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: MAX_FILE_SIZE,
      filter: function ({ mimetype }) {
        return mimetype && ALLOWED_TYPES.includes(mimetype);
      },
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.receipt) ? files.receipt[0] : files.receipt;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Generate unique filename
    const fileExt = path.extname(file.originalFilename || '');
    const fileName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
    const newPath = path.join(uploadDir, fileName);

    // Move file to final location
    await fs.rename(file.filepath, newPath);

    // Create receipt record
    const receipt = await req.rlsContext.execute(async () => {
      return await prismaWithRLS.receipt.create({
      data: {
        userId: session.user.id,
        imageUrl: `/uploads/receipts/${fileName}`,
        totalAmount: 0,
        date: new Date();
    }),
        processingStatus: 'PENDING',
        aiProvider: 'gemini',
        aiModel: 'gemini-1.5-flash',
      },
    });

    // Queue for AI processing
    res.status(200).json({
      success: true,
      receiptId: receipt.id,
      message: 'Receipt uploaded successfully and queued for processing',
    });

  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
}