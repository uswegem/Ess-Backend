const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const dotenv = require('dotenv');
dotenv.config();
const logger = require('./src/utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');

// Validate environment variables before proceeding (skip in test mode)
const { validateEnvironment, validateEnvPatterns, logEnvironmentConfig } = require('./src/config/validateEnv');
if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnvironment();
    validateEnvPatterns();
    logEnvironmentConfig();
  } catch (error) {
    logger.error('Environment validation failed:', { error: error.message });
    process.exit(1);
  }
}

// Import routes
const apiRouter = require('./src/routes/api');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/auth');
const auditRoutes = require('./src/routes/audit');
const adminCompatRoutes = require('./src/routes/adminCompat');
const loanActionsRoutes = require('./src/routes/loanActions');
const frontendApiRoutes = require('./src/routes/frontendApi');
// const messageRoutes = require('./src/routes/messages'); // Temporarily commented out

// Import middleware
const { verifySignatureMiddleware } = require('./src/middleware/signatureMiddleware');
const { auditMiddleware } = require('./src/middleware/authMiddleware');
const { httpMetricsMiddleware, metricsHandler, trackLoanMessage, trackLoanError } = require('./src/middleware/metricsMiddleware');

// Import database
const connectDB = require('./src/config/database');

logger.info('=== SERVER STARTING AT', new Date().toISOString(), '===');

// Clear require cache for development
delete require.cache[require.resolve('./src/services/loanService')];

const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy',
        time: new Date().toISOString(),
        uptime: process.uptime()
    });
});
const PORT = process.env.PORT || 3002;

// Connect to MongoDB
connectDB();

// ========== MIDDLEWARE ORDER ==========

// 1. Security middleware
app.use(helmet());
app.use(cors());

// Add metrics middleware
app.use(httpMetricsMiddleware);

// 2. Compression
app.use(compression({
    level: 6, // Good balance between speed and compression
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// 3. Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// 3. Body parsing middleware for both XML and JSON
app.use(express.raw({ 
    type: ['application/xml', 'text/xml'],
    limit: '10mb'
}));

app.use(express.json({ 
    limit: '10mb'
}));

app.use(express.text({ 
    type: ['text/plain'],
    limit: '10mb'
}));

// 4. Custom content-type middleware
app.use((req, res, next) => {
    const contentType = req.headers['content-type'];

    // Only log detailed request info in debug mode
    if (logger.level === 'debug' || process.env.NODE_ENV === 'development') {
        logger.info('📨 Incoming Request:');
        logger.info(`   Method: ${req.method}`);
        logger.info(`   Path: ${req.path}`);
        logger.info(`   Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
        logger.info(`   Content-Type: ${contentType}`);
        logger.info(`   Source IP: ${req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'}`);
        logger.info(`   X-Forwarded-For: ${req.get('X-Forwarded-For') || 'none'}`);
        logger.info(`   X-Real-IP: ${req.get('X-Real-IP') || 'none'}`);
        logger.info(`   User-Agent: ${req.get('User-Agent') || 'not provided'}`);
        logger.info(`   All Headers: ${JSON.stringify(req.headers, null, 2)}`);
        logger.info(`   Body type: ${typeof req.body}`);
    } else {
        logger.info(`📨 ${req.method} ${req.path} - ${contentType || 'no content-type'}`);
    }

    // Handle XML content
    if (contentType && (contentType.includes('application/xml') || contentType.includes('text/xml'))) {
        if (Buffer.isBuffer(req.body)) {
            // Convert buffer to string for XML
            req.body = req.body.toString('utf8');
            if (logger.level === 'debug') {
                logger.info('   📝 Converted buffer to XML string');
            }
        }
    }

    next();
});

// 5. Debug middleware
app.use((req, res, next) => {
    logger.info('=== INCOMING REQUEST ===');
    logger.info(`Method: ${req.method}`);
    logger.info(`Path: ${req.path}`);
    logger.info(`Content-Type: ${req.get('Content-Type')}`);
    logger.info(`Body exists: ${!!req.body}`);
    
    // Structured logging for dashboard
    if (req.body && typeof req.body === 'string' && (req.body.includes('<?xml') || req.body.includes('<Document>'))) {
        // Log structured XML request for dashboard
        logger.info('📥 DASHBOARD_XML_REQUEST', {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            messageType: req.body.match(/<MessageType>(.*?)<\/MessageType>/)?.[1] || 'UNKNOWN',
            sender: req.body.match(/<Sender>(.*?)<\/Sender>/)?.[1] || 'UNKNOWN',
            xmlContent: req.body,
            contentLength: req.body.length
        });
    }
    
    if (req.body) {
        if (typeof req.body === 'string') {
            logger.info('Body type: XML/String');
            logger.info(`Body length: ${req.body.length}`);
            logger.info(`Body sample: ${req.body.substring(0, 500)}`);
            logger.info(`Full XML Body: ${req.body}`);  // Add full XML content
        } else if (typeof req.body === 'object') {
            logger.info('Body type: JSON/Object');
            logger.info(`Body keys: ${Object.keys(req.body).join(', ')}`);
            logger.info(`Body sample: ${JSON.stringify(req.body).substring(0, 500)}`);
            logger.info(`Full JSON Body: ${JSON.stringify(req.body, null, 2)}`);  // Add full JSON content
        }
    }
    logger.info('========================');

    // Intercept response to log outgoing data
    const originalSend = res.send;
    res.send = function(data) {
        logger.info('📤 OUTGOING RESPONSE:');
        logger.info(`Status Code: ${res.statusCode}`);
        logger.info(`Content-Type: ${res.get('Content-Type') || 'not set'}`);
        
        // Structured logging for dashboard
        if (data && typeof data === 'string' && (data.includes('<?xml') || data.includes('<Document>'))) {
            logger.info('📤 DASHBOARD_XML_RESPONSE', {
                timestamp: new Date().toISOString(),
                statusCode: res.statusCode,
                contentType: res.get('Content-Type') || 'application/xml',
                messageType: data.match(/<MessageType>(.*?)<\/MessageType>/)?.[1] || 'RESPONSE',
                responseCode: data.match(/<ResponseCode>(.*?)<\/ResponseCode>/)?.[1] || data.match(/<StatusCode>(.*?)<\/StatusCode>/)?.[1] || '8000',
                xmlContent: data,
                contentLength: data.length
            });
        } else if (data && typeof data === 'string') {
            logger.info(`Response Length: ${data.length}`);
            logger.info(`Response Sample: ${data.substring(0, 500)}`);
        } else if (data && typeof data === 'object') {
            logger.info('Response Type: JSON');
            logger.info(`Full Response JSON: ${JSON.stringify(data, null, 2)}`);
        }
        logger.info('📤 ========================');
        
        return originalSend.call(this, data);
    };

    next();
});

// 6. Audit middleware for all routes
app.use(auditMiddleware);

// ========== ROUTES ==========

// Swagger API Documentation (public access for developer convenience)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ESS Loan API Documentation',
    customfavIcon: '/favicon.ico'
}));

// Expose Swagger JSON spec
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Metrics endpoint (no auth required for monitoring)
app.get('/metrics', metricsHandler);

// Authentication routes (before signature middleware and main API routes)
app.use('/api/v1/auth', authRoutes);
app.use('/api/auth', authRoutes); // Compatibility route for existing admin portal

// Test endpoint to verify route registration
app.get('/api/auth/test', (req, res) => {
    res.json({ success: true, message: 'Auth route is working' });
});

// Frontend API routes (for React frontend - JSON only, no XML signature required)
app.use('/api/frontend', frontendApiRoutes);

// User management routes (protected)  
app.use('/api/v1/users', userRoutes);

// Audit routes (protected)
app.use('/api/v1/audit', auditRoutes);

// Admin compatibility routes for MiraAdmin frontend
app.use('/api/v1', adminCompatRoutes);

// Product management routes
const productRoutes = require('./src/routes/products');
app.use('/api/v1/products', productRoutes);

// Loan action routes for manual notifications (protected)
app.use('/api/v1/loan-actions', loanActionsRoutes);

// MIFOS administration and monitoring routes
const mifosAdminRoutes = require('./src/routes/mifosAdmin');
app.use('/api/v1/mifos', mifosAdminRoutes);

// Circuit breaker monitoring routes
const circuitBreakerRoutes = require('./src/routes/circuitBreaker');
app.use('/api/v1/circuit-breaker', circuitBreakerRoutes);

// Message management routes (protected) - Temporarily commented out
// app.use('/api/v1/messages', messageRoutes);

// Miracore API routes (after specific routes to avoid conflicts)
app.use('/api', apiRouter);

// 7. Signature verification for XML endpoints (after auth routes)
app.use(verifySignatureMiddleware);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Health check endpoint (supports both JSON and XML)
app.get('/health', (req, res) => {
    const acceptHeader = req.get('Accept');
    const responseData = { 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Miracore Backend',
        database: 'Connected',
        environment: process.env.NODE_ENV || 'development'
    };

    // Return XML if client prefers XML, otherwise JSON
    if (acceptHeader && acceptHeader.includes('application/xml')) {
        const xml2js = require('xml2js');
        const builder = new xml2js.Builder({
            rootName: 'HealthResponse',
            renderOpts: { pretty: true }
        });
        
        const xmlResponse = builder.buildObject(responseData);
        res.set('Content-Type', 'application/xml');
        res.send(xmlResponse);
    } else {
        res.json(responseData);
    }
});

// Test endpoint for both XML and JSON
app.post('/api/v1/test', (req, res) => {
    const contentType = req.get('Content-Type');
    const acceptHeader = req.get('Accept');
    
    logger.info('Test endpoint called:');
    logger.info('   Content-Type:', contentType);
    logger.info('   Accept:', acceptHeader);
    logger.info('   Body type:', typeof req.body);
    
    const responseData = {
        message: 'Request received successfully',
        contentType: contentType,
        bodyType: typeof req.body,
        timestamp: new Date().toISOString()
    };

    // Return response in same format as request, or JSON by default
    if (acceptHeader && acceptHeader.includes('application/xml')) {
        const xml2js = require('xml2js');
        const builder = new xml2js.Builder({
            rootName: 'TestResponse',
            renderOpts: { pretty: true }
        });
        
        const xmlResponse = builder.buildObject(responseData);
        res.set('Content-Type', 'application/xml');
        res.send(xmlResponse);
    } else {
        res.json(responseData);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Error:', err);
    
    const acceptHeader = req.get('Accept');
    
    if (acceptHeader && acceptHeader.includes('application/xml')) {
        const xml2js = require('xml2js');
        const builder = new xml2js.Builder({
            rootName: 'ErrorResponse',
            renderOpts: { pretty: true }
        });
        
        const errorResponse = builder.buildObject({
            success: false,
            message: 'Internal server error',
            timestamp: new Date().toISOString()
        });
        
        res.set('Content-Type', 'application/xml');
        res.status(500).send(errorResponse);
    } else {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// 404 handler
app.use('*', (req, res) => {
    const acceptHeader = req.get('Accept');
    
    if (acceptHeader && acceptHeader.includes('application/xml')) {
        const xml2js = require('xml2js');
        const builder = new xml2js.Builder({
            rootName: 'ErrorResponse',
            renderOpts: { pretty: true }
        });
        
        const errorResponse = builder.buildObject({
            success: false,
            message: 'Endpoint not found',
            timestamp: new Date().toISOString()
        });
        
        res.set('Content-Type', 'application/xml');
        res.status(404).send(errorResponse);
    } else {
        res.status(404).json({
            success: false,
            message: 'Endpoint not found'
        });
    }
});

// Export app for testing
module.exports = app;

// Only start server if not in test mode
if (require.main === module || process.env.NODE_ENV !== 'test') {
  // Create server with proper error handling
  const server = app.listen(PORT, async () => {
    try {
        logger.info(`Miracore Backend running on port ${PORT}`);
        logger.info(`Supports: XML & JSON`);
        logger.info(`Authentication: Enabled`);
        logger.info(`Database: MongoDB`);
        logger.info(`Initial Super Admin: superadmin / SuperAdmin123!`);
        logger.info(`Digital signature: ${process.env.PRIVATE_KEY_PATH ? 'Enabled' : 'Disabled'}`);
        
        // Write PID file for process management
        const fs = require('fs');
        fs.writeFileSync('server.pid', process.pid.toString());

        // Verify database connection
        await new Promise((resolve, reject) => {
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState === 1) {
                resolve();
            } else {
                mongoose.connection.once('connected', resolve);
                mongoose.connection.once('error', reject);
            }
        });

        logger.info('✅ Server ready and database connected');
        
        // Signal PM2 that app is ready (for cluster mode)
        if (process.send) {
            process.send('ready');
            logger.info('📡 Sent ready signal to PM2');
        }
    } catch (error) {
        logger.error('❌ Error during server startup:', error);
        process.exit(1);
    }
}).on('error', (err) => {
    logger.error('❌ Server failed to start:', err.message);
    if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Trying to terminate existing process...`);
        try {
            const fs = require('fs');
            if (fs.existsSync('server.pid')) {
                const pid = parseInt(fs.readFileSync('server.pid', 'utf8'));
                if (pid) {
                    process.kill(pid, 'SIGTERM');
                    logger.info(`Terminated process ${pid}`);
                    startServer();
                }
            }
        } catch (e) {
            logger.error('Failed to terminate existing process:', e.message);
        }
    }
    process.exit(1);
  });

  // Graceful shutdown handling
  process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Close database connections
        const mongoose = require('mongoose');
        try {
            await mongoose.connection.close(false);
            logger.info('MongoDB connection closed');
        } catch (error) {
            logger.error('Error closing MongoDB connection:', error);
        }
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
    });
    
    // Force close after 30s if graceful shutdown fails
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
  });

  process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      
      server.close(async () => {
          logger.info('HTTP server closed');
          
          // Close database connections
          const mongoose = require('mongoose');
          try {
              await mongoose.connection.close(false);
              logger.info('MongoDB connection closed');
          } catch (error) {
              logger.error('Error closing MongoDB connection:', error);
          }
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
      });
      
      // Force close after 30s if graceful shutdown fails
      setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
      }, 30000);
  });
}