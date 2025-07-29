import { promises as fs } from 'fs';
import path from 'path';

import formidable from 'formidable';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { v4 as uuidv4 } from 'uuid';

import { ApiResponse } from '../../../lib/api/response';
import { withAuth } from '../../../lib/middleware/auth';
import prisma from '../../../lib/prisma';
import { authOptions } from '../auth/[...nextauth]';


export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json(ApiResponse.error('Method not allowed'));
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json(ApiResponse.error('Unauthorized'));
    }

    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;

    if (!imageFile) {
      return res.status(400).json(ApiResponse.error('No image file provided'));
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(imageFile.mimetype || '')) {
      return res.status(400).json(ApiResponse.error('Invalid file type. Only JPG and PNG are allowed'));
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const fileExtension = path.extname(imageFile.originalFilename || '.jpg');
    const fileName = `${session.user.id}-${uuidv4()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    // Move file to uploads directory
    const fileData = await fs.readFile(imageFile.filepath);
    await fs.writeFile(filePath, fileData);

    // Clean up temp file
    await fs.unlink(imageFile.filepath);

    // Update user profile image
    const imageUrl = `/uploads/profiles/${fileName}`;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: imageUrl },
    });

    // Delete old profile image if exists
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });

    if (user?.image && user.image !== imageUrl && user.image.startsWith('/uploads/')) {
      const oldImagePath = path.join(process.cwd(), 'public', user.image);
      try {
        await fs.unlink(oldImagePath);
      } catch (error) {
        // Ignore error if file doesn't exist
      }
    }

    return res.status(200).json(ApiResponse.success({
      message: 'Profile image uploaded successfully',
      imageUrl,
    }));
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return res.status(500).json(ApiResponse.error('Failed to upload profile image'));
  }
}

export default withAuth(handler);