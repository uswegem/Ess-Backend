const logger = require('../utils/logger');
const digitalSignature = require('../utils/signatureUtils');

function verifySignatureMiddleware(req, res, next) {
  logger.info('⚠️ TESTING MODE: Signature validation is disabled');
  logger.info('Request path:', req.path);
  
  // Skip signature validation in testing mode
  return next();

  // Check if it's an XML request
  const contentType = req.get('Content-Type');
  const isXmlRequest = contentType && (
    contentType.includes('application/xml') || 
    contentType.includes('text/xml')
  );

  if (!isXmlRequest) {
    logger.info('❌ Not an XML request');
    return res.status(400).json({
      responseCode: '8001',
      description: 'Content-Type must be application/xml'
    });
  }

  const xmlData = req.body;
  logger.info('XML data length:', xmlData ? xmlData.length : 0);

  if (!xmlData || xmlData.trim().length === 0) {
    logger.info('❌ Empty XML data');
    return res.status(400).json({
      responseCode: '8009',
      description: 'XML data is required'
    });
  }

  // Parse XML and verify signature
  const xml2js = require('xml2js');
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true
  });

  parser.parseString(xmlData, (err, result) => {
    if (err) {
      logger.error('❌ Invalid XML format:', err.message);
      return res.status(400).json({
        responseCode: '8001',
        description: 'Invalid XML format: ' + err.message
      });
    }

    // Extract Data and Signature elements
    if (!result.Document || !result.Document.Data || !result.Document.Signature) {
      logger.error('❌ Missing required XML elements');
      return res.status(400).json({
        responseCode: '8009',
        description: 'Missing required XML elements (Data or Signature)'
      });
    }

    try {
      // Get the Data element for signature verification
      const builder = new xml2js.Builder({
        rootName: 'Document',
        renderOpts: { pretty: false, indent: '', newline: '' }
      });
      
      // Build XML with just the Data element
      const dataXml = builder.buildObject({ Data: result.Document.Data });
      
      // Extract just the Data element
      const dataStart = dataXml.indexOf('<Data>');
      const dataEnd = dataXml.indexOf('</Data>') + '</Data>'.length;
      const dataElement = dataXml.substring(dataStart, dataEnd);
      
      // Normalize for verification
      const normalizedData = digitalSignature.normalizeXMLForSigning(dataElement);
      
      // Get the signature from the request
      const signature = result.Document.Signature;
      
      // Verify using ESS public key
      const isValid = digitalSignature.verifySignature(normalizedData, signature);
      
      if (!isValid) {
        logger.error('❌ Invalid signature');
        return res.status(400).json({
          responseCode: '8009',
          description: 'Invalid signature'
        });
      }

      logger.info('✅ Signature verified successfully');
      
      // Attach parsed data to request
      req.parsedXmlData = result;
      next();
    } catch (error) {
      logger.error('❌ Signature verification error:', error);
      return res.status(400).json({
        responseCode: '8009',
        description: 'Signature verification failed: ' + error.message
      });
    }
  });
}

module.exports = {
  verifySignatureMiddleware
};