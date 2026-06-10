const axios = require('axios');
const digitalSignature = require('../utils/signatureUtils');
const { getMessageId } = require('../utils/messageIdGenerator');
const logger = require('../utils/logger');

// Main controller function
exports.triggerLoanStatusRequest = async (req, res) => {
  try {
    // Get parameters from request body
    const { Sender = 'ZE DONE', Receiver = 'ESS_UTUMISHI', FSPCode = 'FL8090', ApplicationNumber } = req.body;
    const MsgId = req.body.MsgId || getMessageId('LOAN_STATUS_REQUEST');
    
    if (!ApplicationNumber) {
      return res.status(400).json({ success: false, error: 'ApplicationNumber is required' });
    }

    // Build data object according to e-MKOPO specification
    const dataObject = {
      Header: {
        Sender,
        Receiver,
        FSPCode,
        MsgId,
        MessageType: 'LOAN_STATUS_REQUEST'
      },
      MessageDetails: {
        ApplicationNumber
      }
    };

    logger.info('Building LOAN_STATUS_REQUEST for application:', ApplicationNumber);

    // Use createSignedXML for proper signature generation
    const signedXml = digitalSignature.createSignedXML(dataObject);

    logger.info('LOAN_STATUS_REQUEST signed successfully, sending to ESS...');

    // Send to ESS endpoint
    const essUrl = process.env.THIRD_PARTY_BASE_URL || 'http://154.118.230.140:9802/ess-loans/mvtyztwq/consume';
    const essResponse = await axios.post(essUrl, signedXml, {
      headers: { 
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
      },
      timeout: 30000
    });

    logger.info('ESS Response received:', essResponse.status);

    // Return ESS response
    res.status(200).json({ success: true, sent: signedXml, essResponse: essResponse.data });
  } catch (error) {
    logger.error('Error in LOAN_STATUS_REQUEST:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
