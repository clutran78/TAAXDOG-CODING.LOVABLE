import { NextApiRequest, NextApiResponse } from 'next';
import { createHealthCheckHandler } from '../../../lib/services/database/prisma-helpers';

// Create the health check handler
const handler = createHealthCheckHandler();

export default handler;
