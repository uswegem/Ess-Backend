const axios = require('axios');
const digitalSignature = require('../utils/signatureUtils');
const { getMessageId } = require('../utils/messageIdGenerator');
const logger = require('../utils/logger');
const { getUtumishiEndpoint, getApiTimeoutMs } = require('../config/runtimeEnv');
const { logOutgoingMessage, updateMessageLog } = require('../utils/messageLogger');
const LoanMappingService = require('../services/loanMappingService');
const { parseEssResponseCode } = require('../utils/essResponseParser');

// Main controller function
exports.triggerLoanStatusRequest = async (req, res) => {
  let messageLog = null;
  const tenant = req.tenant;

  try {
    const { ApplicationNumber } = req.body;
    const MsgId = req.body.MsgId || getMessageId('LOAN_STATUS_REQUEST');

    if (!ApplicationNumber) {
      return res.status(400).json({ success: false, error: 'ApplicationNumber is required' });
    }

    if (!tenant?.tenantId || !tenant?.fspCode) {
      return res.status(403).json({ success: false, error: 'No tenant context resolved for this request' });
    }

    // Tenant scope check: the referenced loan application must belong to the caller's tenant.
    const mapping = await LoanMappingService.getByEssApplicationNumber(ApplicationNumber, true, tenant.tenantId);
    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: `No loan application ${ApplicationNumber} found for this tenant`
      });
    }

    // FSP identity is always derived from the authenticated tenant, never the caller's body.
    const Sender = tenant.fspName || 'ZE DONE';
    const Receiver = 'ESS_UTUMISHI';
    const FSPCode = tenant.fspCode;

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

    // Pass MsgId through explicitly - it's already embedded in signedXml's Header.MsgId
    // (built above), and logOutgoingMessage must not generate a second, different one for
    // the same send or the log becomes untraceable to what was actually signed/sent (same
    // bug found and fixed in outgoingMessageService.js's sendOutgoingMessage).
    messageLog = await logOutgoingMessage(signedXml, 'LOAN_STATUS_REQUEST', {
      applicationNumber: ApplicationNumber,
      tenantId: tenant.tenantId,
      tenantObjectId: tenant.tenantObjectId,
      fspCode: FSPCode,
      correlationId: req.correlationId
    }, req.user?._id || null, MsgId);

    logger.info('LOAN_STATUS_REQUEST signed successfully, sending to ESS...');

    // Send to ESS endpoint
    const essUrl = getUtumishiEndpoint({ required: true });
    const essResponse = await axios.post(essUrl, signedXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
      },
      timeout: getApiTimeoutMs()
    });

    logger.info('ESS Response received:', essResponse.status);

    if (messageLog) {
      await updateMessageLog(messageLog.messageId, 'sent', essResponse.data, null, tenant.tenantId);
    }

    // Return ESS response
    const { responseCode, statusDesc } = await parseEssResponseCode(essResponse.data);
    res.status(200).json({ success: true, sent: signedXml, essResponse: essResponse.data, responseCode, statusDesc });
  } catch (error) {
    logger.error('Error in LOAN_STATUS_REQUEST:', error.message);
    if (messageLog) {
      await updateMessageLog(messageLog.messageId, 'failed', null, error.message, tenant?.tenantId);
    }
    res.status(500).json({ success: false, error: error.message });
  }
};
