import { NextApiRequest, NextApiResponse } from 'next';
import { withSecurity } from '@/lib/middleware/security';
import { body, CustomValidator } from 'express-validator';
import { Session } from 'next-auth';

// Define authenticated request interface
interface AuthenticatedNextApiRequest extends NextApiRequest {
  user?: Session['user'];
}

// Constants for image validation
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB limit
const ALLOWED_IMAGE_FORMATS = {
  '/9j/': 'jpeg', // JPEG magic bytes
  'iVBORw0KGgo': 'png', // PNG magic bytes
  'R0lGOD': 'gif', // GIF magic bytes (optional)
};

// Custom validator for image format and size
const validateImageData: CustomValidator = (value) => {
  if (!value) {
    throw new Error('Image data is required');
  }

  try {
    // Decode base64 to check size
    const decoded = Buffer.from(value, 'base64');
    
    // Check size limit
    if (decoded.length > MAX_IMAGE_SIZE) {
      throw new Error(`Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }
    
    // Check for valid image format by inspecting magic bytes
    const base64Header = value.substring(0, 20);
    let isValidFormat = false;
    
    for (const [magicBytes] of Object.entries(ALLOWED_IMAGE_FORMATS)) {
      if (base64Header.startsWith(magicBytes)) {
        isValidFormat = true;
        break;
      }
    }
    
    if (!isValidFormat) {
      throw new Error('Invalid image format. Only JPEG, PNG, and GIF formats are allowed');
    }
    
    // Additional check: ensure base64 is valid
    if (decoded.toString('base64') !== value) {
      throw new Error('Invalid base64 encoding');
    }
    
    return true;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Invalid image data');
  }
};

// Custom validator for content type if provided
const validateContentType: CustomValidator = (value) => {
  if (!value) return true; // Optional field
  
  const allowedContentTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!allowedContentTypes.includes(value)) {
    throw new Error('Invalid content type. Only JPEG, PNG, and GIF images are allowed');
  }
  
  return true;
};

const validations = [
  body('imageData')
    .notEmpty().withMessage('Image data is required')
    .isBase64().withMessage('Image data must be base64 encoded')
    .custom(validateImageData),
  body('contentType')
    .optional()
    .custom(validateContentType),
  body('category')
    .optional()
    .isIn(['food', 'transport', 'utilities', 'medical', 'other'])
    .withMessage('Invalid category'),
];

export default withSecurity(async (req: AuthenticatedNextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageData, category, contentType } = req.body;
  
  // Runtime check to ensure user exists
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = req.user;

  // Validate image size and format have passed custom validation
  // Additional server-side validation can be added here
  
  try {
    // Decode image for processing
    const imageBuffer = Buffer.from(imageData, 'base64');
    
    // Log image details for monitoring
    console.log('Processing receipt image:', {
      userId: user.id,
      imageSize: imageBuffer.length,
      category,
      contentType,
      timestamp: new Date().toISOString()
    });
    
    // Your receipt processing logic here
    // This is just an example
    
    res.status(200).json({ 
      message: 'Receipt processed successfully',
      receipt: {
        id: 'example-id',
        userId: user.id,
        category,
        imageSize: imageBuffer.length,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Receipt processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process receipt',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}, { 
  rateLimit: 'receipts',
  validations,
  allowedMethods: ['POST']
});