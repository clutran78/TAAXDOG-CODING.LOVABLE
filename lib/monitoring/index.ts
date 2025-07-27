// Central monitoring exports and initialization
export { DatabaseMonitor, createPrismaWithMonitoring } from './database';
export { 
  withApiMonitoring,
  startMonitoring,
  completeMonitoring,
  getCurrentMetrics,
  getEndpointMetrics,
  getHealthMetrics,
  resetEndpointMetrics,
  resetAllMetrics,
} from './api';
// Backward compatibility export
export { withApiMonitoring as ApiMonitor } from './api';
export { ApplicationMonitor, withPerformanceMonitoring } from './application';
export { ClientMonitor } from './client';

// Initialize monitoring for Next.js app
import { ApplicationMonitor } from './application';

// Start application monitoring when this module is imported
if (typeof window === 'undefined') {
  // Server-side only
  ApplicationMonitor.getInstance();
}
