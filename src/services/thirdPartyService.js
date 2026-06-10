const logger = require('../utils/logger');
const axios = require('axios');
const digitalSignature = require('../utils/signatureUtils');
const { logOutgoingMessage, updateMessageLog } = require('../utils/messageLogger');

const THIRD_PARTY_BASE_URL = process.env.THIRD_PARTY_BASE_URL;
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT) || 30000;

async function forwardToThirdParty(signedXml, messageType, metadata = {}, userId = null) {
  let messageLog = null;

  try {
    logger.info(' Preparing to send to ESS...');
    
    // Log the outgoing message
    messageLog = await logOutgoingMessage(signedXml, messageType, metadata, userId);
    
    // Check if URL is configured
    if (!THIRD_PARTY_BASE_URL) {
      throw new Error('THIRD_PARTY_BASE_URL environment variable is not set');
    }

    // Validate URL format
    try {
      new URL(THIRD_PARTY_BASE_URL);
    } catch (urlError) {
      throw new Error(`Invalid THIRD_PARTY_BASE_URL: ${THIRD_PARTY_BASE_URL}`);
    }

    logger.info('Target ESS URL:', THIRD_PARTY_BASE_URL);
    logger.info('Message Type:', messageType);
    logger.info('Signed XML Size:', signedXml.length, 'characters');

    const config = {
      method: 'post',
      url: THIRD_PARTY_BASE_URL,
      data: signedXml,
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
        'User-Agent': 'Miracore-Backend/1.0'
      },
      timeout: API_TIMEOUT,
      // Add more debugging info
      validateStatus: function (status) {
        return status >= 200 && status < 600; // Accept all status codes for debugging
      }
    };

    logger.info(' Sending signed request to ESS...');
    
    const response = await axios(config);
    
    logger.info(`ESS Response Status: ${response.status}`);
    logger.info('ESS Response Headers:', JSON.stringify(response.headers));
    
    // Handle specific error codes in response data
    if (response.status !== 200 || (response.data && response.data.ResponseCode === '9005')) {
      logger.error('ESS returned error response:', response.data);
      
      // Update message log with failure
      if (messageLog) {
        await updateMessageLog(messageLog.messageId, 'failed', response.data, 'ESS returned error response');
      }
      
      throw new Error('ESS returned error: ' + (response.data.Description || 'Unknown error'));
    }
    
    if (response.data) {
      logger.info('ESS Response Body Length:', response.data.length, 'characters');
      logger.info('ESS Response Body (first 500 chars):', response.data.substring(0, 500));
    } else {
      logger.info('ESS Response: No body');
    }
    
    // Update message log with success
    if (messageLog) {
      await updateMessageLog(messageLog.messageId, 'sent', response.data);
    }
    
    return response.data;

  } catch (error) {
    logger.error('ESS Communication Error:');
    
    // Update message log with error
    if (messageLog) {
      await updateMessageLog(messageLog.messageId, 'failed', null, error.message);
    }
    
    if (error.code === 'ENOTFOUND') {
      throw new Error(`Cannot connect to ESS: ${error.hostname} not found`);
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(`ESS connection refused: ${THIRD_PARTY_BASE_URL}`);
    } else if (error.response) {
      // ESS responded with error status
      logger.info('ESS Error Response Details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data ? error.response.data.substring(0, 500) : 'No data'
      });
      
      // If ESS returns XML error, return it directly
      if (error.response.data && typeof error.response.data === 'string') {
        return error.response.data;
      }
      
      throw new Error(`ESS responded with status: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      logger.info('No response received from ESS');
      throw new Error('No response received from ESS - connection timeout or network issue');
    } else {
      logger.info('Request setup error:', error.message);
      throw error;
    }
  }
}

module.exports = {
  forwardToThirdParty
};