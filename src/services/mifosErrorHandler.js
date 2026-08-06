const logger = require('../utils/logger');

/**
 * MIFOS Error Handler
 * Centralized error handling for MIFOS operations with detailed classification
 */
class MifosErrorHandler {
    constructor() {
        this.errorCodes = {
            // Authentication errors
            'UNAUTHENTICATED': { code: 401, type: 'auth', retry: true },
            'UNAUTHORIZED': { code: 403, type: 'auth', retry: false },
            'TOKEN_EXPIRED': { code: 401, type: 'auth', retry: true },
            
            // Client errors
            'CLIENT_NOT_FOUND': { code: 404, type: 'client', retry: false },
            'CLIENT_ALREADY_EXISTS': { code: 409, type: 'client', retry: false },
            'INVALID_CLIENT_DATA': { code: 400, type: 'validation', retry: false },
            
            // Loan errors
            'LOAN_NOT_FOUND': { code: 404, type: 'loan', retry: false },
            'LOAN_ALREADY_EXISTS': { code: 409, type: 'loan', retry: false },
            'INSUFFICIENT_BALANCE': { code: 400, type: 'business', retry: false },
            'LOAN_NOT_ACTIVE': { code: 400, type: 'business', retry: false },
            
            // Network errors
            'NETWORK_ERROR': { code: 500, type: 'network', retry: true },
            'TIMEOUT': { code: 408, type: 'network', retry: true },
            'CONNECTION_REFUSED': { code: 500, type: 'network', retry: true },
            
            // Server errors
            'INTERNAL_SERVER_ERROR': { code: 500, type: 'server', retry: true },
            'SERVICE_UNAVAILABLE': { code: 503, type: 'server', retry: true },
            'BAD_GATEWAY': { code: 502, type: 'server', retry: true }
        };
    }

    /**
     * Handle and classify MIFOS errors
     */
    handleError(error, context = {}) {
        try {
            const errorDetails = this.classifyError(error);
            const enhancedError = {
                ...errorDetails,
                context,
                timestamp: new Date().toISOString(),
                correlationId: context.correlationId || this.generateCorrelationId()
            };

            // Log error with appropriate level
            this.logError(enhancedError);

            return enhancedError;
        } catch (handlingError) {
            logger.error('Error in error handler:', handlingError);
            return this.createFallbackError(error, context);
        }
    }

    /**
     * Classify error type and determine retry strategy
     */
    classifyError(error) {
        // Network/Connection errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return {
                type: 'network',
                category: 'CONNECTION_REFUSED',
                message: 'Unable to connect to MIFOS server',
                originalError: error.message,
                retry: true,
                retryAfter: 5000
            };
        }

        if (error.code === 'ECONNABORTED') {
            return {
                type: 'network', 
                category: 'TIMEOUT',
                message: 'Request to MIFOS timed out',
                originalError: error.message,
                retry: true,
                retryAfter: 3000
            };
        }

        // HTTP Response errors
        if (error.response) {
            const status = error.response.status;
            const responseData = error.response.data;

            switch (status) {
                case 401:
                    return {
                        type: 'authentication',
                        category: 'UNAUTHENTICATED',
                        message: 'Authentication failed with MIFOS',
                        originalError: responseData,
                        retry: true,
                        retryAfter: 1000
                    };

                case 403:
                    return {
                        type: 'authorization',
                        category: 'UNAUTHORIZED',
                        message: 'Insufficient permissions for MIFOS operation',
                        originalError: responseData,
                        retry: false
                    };

                case 404:
                    return {
                        type: 'resource',
                        category: this.determineResourceType(error.config?.url),
                        message: 'Resource not found in MIFOS',
                        originalError: responseData,
                        retry: false
                    };

                case 409:
                    return {
                        type: 'conflict',
                        category: 'RESOURCE_CONFLICT',
                        message: 'Resource already exists in MIFOS',
                        originalError: responseData,
                        retry: false
                    };

                case 400:
                    return {
                        type: 'validation',
                        category: 'INVALID_DATA',
                        message: 'Invalid data sent to MIFOS',
                        originalError: responseData,
                        retry: false,
                        validationErrors: this.extractValidationErrors(responseData)
                    };

                case 500:
                case 502:
                case 503:
                    return {
                        type: 'server',
                        category: 'SERVER_ERROR',
                        message: 'MIFOS server error',
                        originalError: responseData,
                        retry: true,
                        retryAfter: 10000
                    };

                default:
                    return {
                        type: 'unknown',
                        category: 'HTTP_ERROR',
                        message: `HTTP ${status} error from MIFOS`,
                        originalError: responseData,
                        retry: status >= 500
                    };
            }
        }

        // Fallback for unknown errors
        return {
            type: 'unknown',
            category: 'UNKNOWN_ERROR',
            message: error.message || 'Unknown MIFOS error',
            originalError: error,
            retry: false
        };
    }

    /**
     * Determine resource type from URL
     */
    determineResourceType(url) {
        if (!url) return 'UNKNOWN_RESOURCE';
        
        if (url.includes('/clients')) return 'CLIENT_NOT_FOUND';
        if (url.includes('/loans')) return 'LOAN_NOT_FOUND';
        if (url.includes('/loanproducts')) return 'PRODUCT_NOT_FOUND';
        
        return 'RESOURCE_NOT_FOUND';
    }

    /**
     * Extract validation errors from MIFOS response
     */
    extractValidationErrors(responseData) {
        try {
            if (responseData && responseData.errors) {
                return responseData.errors.map(error => ({
                    field: error.parameterName,
                    message: error.defaultUserMessage,
                    code: error.userMessageGlobalisationCode
                }));
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Log error with appropriate level and formatting
     */
    logError(errorDetails) {
        const logData = {
            type: errorDetails.type,
            category: errorDetails.category,
            message: errorDetails.message,
            context: errorDetails.context,
            correlationId: errorDetails.correlationId,
            retry: errorDetails.retry,
            timestamp: errorDetails.timestamp
        };

        if (errorDetails.type === 'network' || errorDetails.type === 'server') {
            logger.warn('🌐 MIFOS Network/Server Error:', logData);
        } else if (errorDetails.type === 'authentication' || errorDetails.type === 'authorization') {
            logger.error('🔐 MIFOS Auth Error:', logData);
        } else if (errorDetails.type === 'validation') {
            logger.warn('📝 MIFOS Validation Error:', logData);
        } else {
            logger.error('❌ MIFOS Error:', logData);
        }
    }

    /**
     * Create fallback error when error handling fails
     */
    createFallbackError(error, context) {
        return {
            type: 'system',
            category: 'ERROR_HANDLER_FAILURE',
            message: 'Error handling failed',
            originalError: error.message || error,
            context,
            retry: false,
            timestamp: new Date().toISOString(),
            correlationId: this.generateCorrelationId()
        };
    }

    /**
     * Generate unique correlation ID for error tracking
     */
    generateCorrelationId() {
        return `mifos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Check if error is retryable
     */
    isRetryable(errorDetails) {
        return errorDetails.retry === true;
    }

    /**
     * Get retry delay for error
     */
    getRetryDelay(errorDetails, attemptNumber = 1) {
        const baseDelay = errorDetails.retryAfter || 1000;
        return Math.min(baseDelay * Math.pow(2, attemptNumber - 1), 30000); // Max 30s
    }
}

// Singleton instance
const errorHandler = new MifosErrorHandler();

module.exports = errorHandler;