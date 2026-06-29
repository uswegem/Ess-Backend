const logger = require('./logger');
const { getUtumishiEndpoint, getApiTimeoutMs } = require('../config/runtimeEnv');

const express = require('express');
const router = express.Router();
const digitalSignature = require('../utils/signatureUtils');
const axios = require('axios');

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

// Helper function to send callback with retry logic
async function sendCallback(callbackData) {
    // Skip callback in test mode
    if (process.env.NODE_ENV === 'test') {
        logger.info('📤 Skipping callback in test mode');
        return { status: 200, data: { success: true, message: 'Test mode - callback skipped' } };
    }

    let retryCount = 0;
    while (retryCount < MAX_RETRIES) {
        try {
            const signedCallback = digitalSignature.createSignedXML(callbackData.Data);
            logger.info(`📤 Attempt ${retryCount + 1}/${MAX_RETRIES} to send callback`);
        
        // Get callback URL from environment variables
        const callbackUrl = getUtumishiEndpoint({ required: true });

        logger.info('📤 Sending callback:', {
            url: callbackUrl,
            messageType: callbackData.Data?.Header?.MessageType || callbackData.Header?.MessageType || 'UNKNOWN',
            data: JSON.stringify(callbackData, null, 2)
        });

        logger.info('📝 Signed XML Payload:', signedCallback);

        const response = await axios({
            method: 'post',
            url: callbackUrl,
            headers: {
                'Content-Type': 'application/xml',
                'X-Request-ID': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            },
            data: signedCallback,
            timeout: getApiTimeoutMs(),
            validateStatus: function (status) {
                return status >= 200 && status < 500; // Accept all responses to log them
            }
        });

        // Log the complete response information
        logger.info('📥 Callback response:', {
            status: response.status,
            statusText: response.statusText,
            messageType: callbackData.Data?.Header?.MessageType || callbackData.Header?.MessageType || 'UNKNOWN',
            headers: response.headers,
            data: response.data
        });

        if (response.status >= 400) {
            throw new Error(`Callback failed with status ${response.status}: ${response.statusText}`);
        }

        return response;
    } catch (error) {
        logger.error('❌ Error sending callback:', {
            message: error.message,
            stack: error.stack,
            responseData: error.response?.data,
            responseStatus: error.response?.status,
            responseHeaders: error.response?.headers
        });
        // If not the last attempt, wait before retrying
        if (retryCount < MAX_RETRIES - 1) {
            logger.info(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            retryCount++;
            continue;
        }
        throw error;
    }
    break; // Success, exit retry loop
    }
}

module.exports = { sendCallback };