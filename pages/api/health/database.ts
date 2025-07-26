import { NextApiRequest, NextApiResponse } from 'next';
import { createHealthCheckHandler } from '../../../lib/prisma-helpers';

// Create the health check handler
const handler = createHealthCheckHandler();

export default handler;
