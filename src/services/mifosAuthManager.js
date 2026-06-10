const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Enhanced MIFOS Authentication Manager
 * Handles token-based authentication, refresh, and caching
 */
class MifosAuthManager {
    constructor() {
        this.tokens = {
            maker: null,
            checker: null
        };
        this.tokenExpiry = {
            maker: null,
            checker: null
        };
        this.refreshPromises = new Map();
    }

    /**
     * Get or refresh authentication token
     */
    async getToken(userType = 'maker') {
        try {
            // Check if token is still valid
            if (this.isTokenValid(userType)) {
                return this.tokens[userType];
            }

            // Prevent multiple simultaneous refresh requests
            if (this.refreshPromises.has(userType)) {
                return await this.refreshPromises.get(userType);
            }

            // Create refresh promise
            const refreshPromise = this.refreshToken(userType);
            this.refreshPromises.set(userType, refreshPromise);

            try {
                const token = await refreshPromise;
                return token;
            } finally {
                this.refreshPromises.delete(userType);
            }
        } catch (error) {
            logger.error(`Failed to get ${userType} token:`, error);
            throw error;
        }
    }

    /**
     * Check if current token is valid
     */
    isTokenValid(userType) {
        return this.tokens[userType] && 
               this.tokenExpiry[userType] && 
               Date.now() < this.tokenExpiry[userType];
    }

    /**
     * Refresh authentication token
     */
    async refreshToken(userType) {
        try {
            const credentials = userType === 'maker' ? {
                username: process.env.CBS_MAKER_USERNAME,
                password: process.env.CBS_MAKER_PASSWORD
            } : {
                username: process.env.CBS_CHECKER_USERNAME,
                password: process.env.CBS_CHECKER_PASSWORD
            };

            logger.info(`🔐 Refreshing ${userType} authentication token...`);

            const response = await axios.post(
                `${process.env.CBS_BASE_URL}/v1/authentication`,
                credentials,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'fineract-platform-tenantid': process.env.CBS_Tenant
                    },
                    timeout: 10000
                }
            );

            if (response.status === 200 && response.data.base64EncodedAuthenticationKey) {
                const token = response.data.base64EncodedAuthenticationKey;
                
                // Cache token with expiry (default 12 hours)
                this.tokens[userType] = token;
                this.tokenExpiry[userType] = Date.now() + (12 * 60 * 60 * 1000);

                logger.info(`✅ ${userType} token refreshed successfully`);
                return token;
            } else {
                throw new Error(`Invalid authentication response for ${userType}`);
            }
        } catch (error) {
            logger.error(`❌ Token refresh failed for ${userType}:`, error.message);
            throw error;
        }
    }

    /**
     * Clear all cached tokens (useful for logout/reset)
     */
    clearTokens() {
        this.tokens = { maker: null, checker: null };
        this.tokenExpiry = { maker: null, checker: null };
        logger.info('🗑️ All authentication tokens cleared');
    }

    /**
     * Get authentication header with current token
     */
    async getAuthHeader(userType = 'maker') {
        const token = await this.getToken(userType);
        return {
            'Authorization': `Basic ${token}`
        };
    }
}

// Singleton instance
const authManager = new MifosAuthManager();

module.exports = authManager;