const promClient = require('prom-client');
const logger = require('../utils/logger');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Clear any existing metrics to prevent duplicate registration errors
register.clear();

// Add default metrics (only basic ones to avoid conflicts)
promClient.collectDefaultMetrics({
    register,
    prefix: 'nodejs_'
});

// Custom metrics for ESS application
const loanMessagesTotal = new promClient.Counter({
    name: 'loan_messages_total',
    help: 'Total number of loan messages processed',
    labelNames: ['message_type', 'status'],
    registers: [register]
});

const loanErrorsTotal = new promClient.Counter({
    name: 'loan_errors_total',
    help: 'Total number of loan processing errors',
    labelNames: ['error_type', 'message_type'],
    registers: [register]
});

const databaseQueriesTotal = new promClient.Counter({
    name: 'database_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'table'],
    registers: [register]
});

const processMemoryUsage = new promClient.Gauge({
    name: 'process_memory_usage',
    help: 'Process memory usage in bytes',
    registers: [register]
});

const processCpuUsage = new promClient.Gauge({
    name: 'process_cpu_usage',
    help: 'Process CPU usage percentage',
    registers: [register]
});

const activeHandles = new promClient.Gauge({
    name: 'nodejs_active_handles_total',
    help: 'Total number of active handles',
    registers: [register]
});

const pm2Instances = new promClient.Gauge({
    name: 'pm2_instances',
    help: 'Number of PM2 instances running',
    registers: [register]
});

const loanStatusGauge = new promClient.Gauge({
    name: 'loan_status_count',
    help: 'Number of loans in each status',
    labelNames: ['status'],
    registers: [register]
});

const loanRejectionGauge = new promClient.Gauge({
    name: 'loan_rejections_by_actor',
    help: 'Number of loan rejections by actor',
    labelNames: ['actor'],
    registers: [register]
});

const loanCancellationGauge = new promClient.Gauge({
    name: 'loan_cancellations_by_actor',
    help: 'Number of loan cancellations by actor',
    labelNames: ['actor'],
    registers: [register]
});

const logLevelTotal = new promClient.Counter({
    name: 'log_level_total',
    help: 'Total number of log entries by level',
    labelNames: ['level', 'service'],
    registers: [register]
});

// Note: Metrics are automatically registered when using the 'registers' option

// Middleware to track HTTP requests
const httpMetricsMiddleware = (req, res, next) => {
    next();
};

// Function to track loan messages
const trackLoanMessage = (messageType, status = 'success') => {
    // Validate inputs to prevent Prometheus label errors
    const safeMessageType = (typeof messageType === 'string' && messageType.trim()) ? messageType.trim() : 'unknown';
    const safeStatus = (typeof status === 'string' && status.trim()) ? status.trim() : 'unknown';

    try {
        loanMessagesTotal
            .labels(safeMessageType, safeStatus)
            .inc();
    } catch (error) {
        logger.error('Error tracking loan message:', { error: error.message, messageType, status });
    }
};

// Function to track loan errors
const trackLoanError = (errorType, messageType) => {
    // Validate inputs to prevent Prometheus label errors
    const safeErrorType = (typeof errorType === 'string' && errorType.trim()) ? errorType.trim() : 'unknown_error';
    const safeMessageType = (typeof messageType === 'string' && messageType.trim()) ? messageType.trim() : 'unknown';

    try {
        loanErrorsTotal
            .labels(safeErrorType, safeMessageType)
            .inc();
    } catch (error) {
        logger.error('Error tracking loan error:', { error: error.message, errorType, messageType });
    }
};

// Function to track database queries
const trackDatabaseQuery = (operation, table) => {
    databaseQueriesTotal
        .labels(operation, table)
        .inc();
};

// Function to track log levels
const trackLogLevel = (level, service = 'ess-app') => {
    logLevelTotal
        .labels(level, service)
        .inc();
};

// Variables for CPU calculation
let previousCpuUsage = process.cpuUsage();
let previousTime = Date.now();

// Function to update system metrics
const updateSystemMetrics = () => {
    const memUsage = process.memoryUsage();
    processMemoryUsage.set(memUsage.rss);
    
    // Proper CPU usage percentage calculation
    const currentTime = Date.now();
    const currentCpuUsage = process.cpuUsage();
    
    // Calculate elapsed time in microseconds
    const elapsedTime = (currentTime - previousTime) * 1000; // Convert to microseconds
    
    // Calculate CPU time used in microseconds
    const cpuTimeUsed = (currentCpuUsage.user - previousCpuUsage.user) + 
                       (currentCpuUsage.system - previousCpuUsage.system);
    
    // Calculate CPU percentage (0-100)
    const cpuPercentage = (cpuTimeUsed / elapsedTime) * 100;
    
    // Set the percentage (bounded between 0 and 100)
    processCpuUsage.set(Math.min(Math.max(cpuPercentage, 0), 100));
    
    // Update previous values for next calculation
    previousCpuUsage = currentCpuUsage;
    previousTime = currentTime;
    
    // Active handles
    if (process._getActiveHandles) {
        activeHandles.set(process._getActiveHandles().length);
    }
};

// Function to update loan status metrics
const updateLoanStatusMetrics = async () => {
    try {
        const LoanMapping = require('../models/LoanMapping');

        // Update loan status counts
        const statusStats = await LoanMapping.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Reset all gauges first
        loanStatusGauge.reset();
        loanRejectionGauge.reset();
        loanCancellationGauge.reset();

        // Set new values
        statusStats.forEach(stat => {
            loanStatusGauge.set({ status: stat._id }, stat.count);
        });

        // Update rejection stats
        const rejectionStats = await LoanMapping.aggregate([
            { $match: { status: 'REJECTED', rejectedBy: { $exists: true } } },
            { $group: { _id: '$rejectedBy', count: { $sum: 1 } } }
        ]);

        rejectionStats.forEach(stat => {
            loanRejectionGauge.set({ actor: stat._id }, stat.count);
        });

        // Update cancellation stats
        const cancellationStats = await LoanMapping.aggregate([
            { $match: { status: 'CANCELLED', cancelledBy: { $exists: true } } },
            { $group: { _id: '$cancelledBy', count: { $sum: 1 } } }
        ]);

        cancellationStats.forEach(stat => {
            loanCancellationGauge.set({ actor: stat._id }, stat.count);
        });

    } catch (error) {
        logger.error('Error updating loan status metrics:', error);
    }
};

// Update loan status metrics every 60 seconds (skip in test mode)
if (process.env.NODE_ENV !== 'test') {
    setInterval(updateLoanStatusMetrics, 60000);
    // Initial update
    updateLoanStatusMetrics();
}

// Metrics endpoint
const metricsHandler = async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
    } catch (error) {
        res.status(500).end(error);
    }
};

module.exports = {
    httpMetricsMiddleware,
    metricsHandler,
    trackLoanMessage,
    trackLoanError,
    trackDatabaseQuery,
    trackLogLevel,
    updateLoanStatusMetrics,
    register
};