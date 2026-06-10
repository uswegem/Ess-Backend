const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Import metrics tracking (with try-catch to avoid circular dependencies)
let trackLogLevel;
try {
  const { trackLogLevel: track } = require('../middleware/metricsMiddleware');
  trackLogLevel = track;
} catch (err) {
  // Metrics not available, continue without tracking
  trackLogLevel = () => {};
}

// Winston logger configuration for ESS application
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
      // Track log level for metrics
      if (trackLogLevel) {
        trackLogLevel(info.level);
      }
      return JSON.stringify(info);
    })
  ),
  defaultMeta: { service: 'ess-app' },
  transports: [
    // Error logs
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    // Combined logs
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d'
    })
  ]
});

// Console output for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
