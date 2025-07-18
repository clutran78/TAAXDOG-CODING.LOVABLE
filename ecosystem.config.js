module.exports = {
  apps: [
    {
      name: 'taaxdog-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true
    }
  ],

  // Cron-like scheduled tasks
  cron_jobs: [
    {
      name: 'compliance-aml',
      script: 'npm',
      args: 'run compliance:aml',
      cron_restart: '0 */4 * * *', // Every 4 hours
      autorestart: false,
      error_file: './logs/aml-monitoring.log',
      out_file: './logs/aml-monitoring.log',
      log_file: './logs/aml-monitoring.log',
      time: true
    },
    {
      name: 'compliance-privacy',
      script: 'npm',
      args: 'run compliance:privacy',
      cron_restart: '0 2 * * *', // Daily at 2 AM
      autorestart: false,
      error_file: './logs/privacy-monitoring.log',
      out_file: './logs/privacy-monitoring.log',
      log_file: './logs/privacy-monitoring.log',
      time: true
    },
    {
      name: 'compliance-apra',
      script: 'npm',
      args: 'run compliance:apra',
      cron_restart: '0 6,18 * * *', // Twice daily at 6 AM and 6 PM
      autorestart: false,
      error_file: './logs/apra-monitoring.log',
      out_file: './logs/apra-monitoring.log',
      log_file: './logs/apra-monitoring.log',
      time: true
    },
    {
      name: 'compliance-all',
      script: 'npm',
      args: 'run compliance:all',
      cron_restart: '0 3 * * *', // Daily at 3 AM
      autorestart: false,
      error_file: './logs/compliance-all.log',
      out_file: './logs/compliance-all.log',
      log_file: './logs/compliance-all.log',
      time: true
    },
    {
      name: 'compliance-monthly-report',
      script: 'npm',
      args: 'run compliance:monthly-report',
      cron_restart: '5 0 1 * *', // 1st of each month at 12:05 AM
      autorestart: false,
      error_file: './logs/monthly-report.log',
      out_file: './logs/monthly-report.log',
      log_file: './logs/monthly-report.log',
      time: true
    },
    {
      name: 'compliance-check-alerts',
      script: 'npm',
      args: 'run compliance:check-alerts',
      cron_restart: '0 * * * *', // Every hour
      autorestart: false,
      error_file: './logs/compliance-alerts.log',
      out_file: './logs/compliance-alerts.log',
      log_file: './logs/compliance-alerts.log',
      time: true
    },
    {
      name: 'compliance-backup-reports',
      script: 'npm',
      args: 'run compliance:backup-reports',
      cron_restart: '0 1 * * 0', // Weekly on Sunday at 1 AM
      autorestart: false,
      error_file: './logs/backup-reports.log',
      out_file: './logs/backup-reports.log',
      log_file: './logs/backup-reports.log',
      time: true
    }
  ]
};