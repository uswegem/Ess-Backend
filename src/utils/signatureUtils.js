const logger = require('./logger');

const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

class DigitalSignature {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.certificate = null;
    this.loadKeys();
  }

  loadKeys() {
    try {
      // Load CA-provided certificate (ESS provides this)
      const certPath = process.env.CERTIFICATE_PATH || path.join(__dirname, '../../keys/fspNameCertificate.crt');
      if (fs.existsSync(certPath)) {
        this.certificate = fs.readFileSync(certPath, 'utf8');
        logger.info('✅ FSP Certificate loaded from:', certPath);
        
        // Extract public key from certificate
        this.extractPublicKeyFromCertificate();
        
        // Validate certificate
        this.validateCertificate();
      } else {
        logger.info('❌ FSP Certificate not found at:', certPath);
        logger.info('💡 You need to obtain fspNameCertificate.crt from ESS/CA');
      }

      // Load private key (you generate this during certificate request)
      const privateKeyPath = process.env.PRIVATE_KEY_PATH || path.join(__dirname, '../../keys/private.pem');
      if (fs.existsSync(privateKeyPath)) {
        this.privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        logger.info('✅ Private key loaded from:', privateKeyPath);
        this.validatePrivateKey();
      } else {
        logger.info('❌ Private key not found at:', privateKeyPath);
        logger.info('💡 Generate private key using: openssl genrsa -out private.pem 2048');
      }

    } catch (error) {
      logger.error('❌ Error loading keys:', error);
    }
  }

  validatePrivateKey() {
    try {
      // Try to use the private key to ensure it's valid
      const testSign = crypto.createSign('SHA256');
      testSign.update('test');
      testSign.end();
      testSign.sign(this.privateKey, 'base64');
      logger.info('✅ Private key validation: PASSED');
    } catch (error) {
      logger.error('❌ Private key validation: FAILED -', error.message);
    }
  }

  extractPublicKeyFromCertificate() {
    try {
      const pki = forge.pki;
      const cert = pki.certificateFromPem(this.certificate);
      this.publicKey = pki.publicKeyToPem(cert.publicKey);
      logger.info('✅ Public key extracted from FSP certificate');
    } catch (error) {
      logger.error('❌ Failed to extract public key from certificate:', error);
    }
  }

  validateCertificate() {
    try {
      const pki = forge.pki;
      const cert = pki.certificateFromPem(this.certificate);
      
      logger.info('📜 FSP Certificate Information:');
      logger.info('   Subject:', cert.subject.attributes.map(attr => `${attr.name}=${attr.value}`).join(', '));
      logger.info('   Issuer:', cert.issuer.attributes.map(attr => `${attr.name}=${attr.value}`).join(', '));
      logger.info('   Valid From:', cert.validity.notBefore);
      logger.info('   Valid To:', cert.validity.notAfter);
      logger.info('   Serial Number:', cert.serialNumber);
      
      // Check if certificate is valid
      const now = new Date();
      if (now < cert.validity.notBefore) {
        logger.warn('⚠️  Certificate not yet valid');
      } else if (now > cert.validity.notAfter) {
        logger.warn('⚠️  Certificate has expired');
      } else {
        logger.info('✅ Certificate validity: PASSED');
      }
    } catch (error) {
      logger.error('❌ Certificate validation failed:', error);
    }
  }

  /**
   * Generate SHA256withRSA signature as per e-MKOPO specification
   */
  generateSignature(xmlData) {
    if (!this.privateKey) {
      throw new Error('Private key not available for signing');
    }

    try {
      logger.info('🔐 Generating SHA256withRSA signature...');
      
      // Normalize XML for consistent signing
      const cleanXml = this.normalizeXMLForSigning(xmlData);
      logger.info('Data to sign length:', cleanXml.length, 'characters');
      
      // Create sign object with SHA256
      const sign = crypto.createSign('SHA256');
      sign.update(cleanXml, 'utf8');
      sign.end();

      // Generate signature with RSA
      const signature = sign.sign({
        key: this.privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, 'base64');

      logger.info('✅ Signature generated');
      logger.info('   Signature length:', signature.length, 'characters');
      
      return signature;
    } catch (error) {
      logger.error('❌ Error generating signature:', error);
      throw new Error('Failed to generate digital signature: ' + error.message);
    }
  }

  /**
   * Normalize XML for consistent signing
   */
  normalizeXMLForSigning(xmlData) {
    try {
      // Convert to string if needed
      const xmlStr = typeof xmlData === 'string' ? xmlData : xmlData.toString();
      
      // Extract just the Data element content
      const dataStart = xmlStr.indexOf('<Data>');
      const dataEnd = xmlStr.indexOf('</Data>') + '</Data>'.length;
      
      if (dataStart === -1 || dataEnd === -1) {
        throw new Error('Data element not found in XML');
      }
      
      let dataElement = xmlStr.substring(dataStart, dataEnd);
      
      // Convert self-closing tags to explicit end tags (e.g., <tag/> to <tag></tag>)
      dataElement = dataElement.replace(/<([^>]+?)\/>/g, '<$1></$1>');
      
      // Remove all whitespace between tags but preserve attribute values
      dataElement = dataElement.replace(/>\s+</g, '><');
      
      // Remove carriage returns and line feeds
      dataElement = dataElement.replace(/\r?\n|\r/g, '');
      
      // Normalize spaces in attribute values (preserve exactly one space)
      dataElement = dataElement.replace(/\s+/g, ' ');
      
      // Remove spaces around equals signs in attributes
      dataElement = dataElement.replace(/\s*=\s*/g, '=');
      
      // Remove leading/trailing whitespace
      dataElement = dataElement.trim();
      
      logger.info('🔄 Normalized XML for signing:', dataElement);
      return dataElement;
    } catch (error) {
      logger.error('❌ Error normalizing XML:', error);
      throw new Error('XML normalization failed: ' + error.message);
    }
  }

  /**
   * Extract the Data element from XML for signing
   */
  extractDataElement(xmlData) {
    try {
      const startTag = '<Data>';
      const endTag = '</Data>';
      const startIndex = xmlData.indexOf(startTag);
      const endIndex = xmlData.indexOf(endTag);

      if (startIndex === -1 || endIndex === -1) {
        throw new Error('Data element not found in XML');
      }

      const dataElement = xmlData.substring(startIndex, endIndex + endTag.length);
      logger.info('📄 Extracted Data element for signing');
      
      return dataElement;
    } catch (error) {
      logger.error('❌ Error extracting Data element:', error);
      throw new Error('Invalid XML structure for signing');
    }
  }

  /**
   * Create signed XML payload according to e-MKOPO specification
   */
  createSignedXML(dataObject) {
    const xml2js = require('xml2js');
    const builder = new xml2js.Builder({
      rootName: 'Document',
      renderOpts: { 
        pretty: false,
        indent: '',
        newline: '',
        allowEmpty: false,
        normalize: false,
        spacebeforeslash: '',
        trim: true
      },
      xmldec: {
        version: '1.0',
        encoding: 'UTF-8',
        standalone: false
      },
      headless: false,
      cdata: false
    });

    logger.info('📝 Building signed XML payload...');
    
    // Build XML without signature first
    const tempDoc = {
      Data: dataObject
    };
    
    const xmlWithoutSignature = builder.buildObject(tempDoc);
    
    // Extract just the Data element for signing
    const dataElement = this.extractDataElement(xmlWithoutSignature);
    
    // Generate signature for the Data part ONLY
    const signature = this.generateSignature(dataElement).trim();
    
    // Build final XML with signature
    const finalDoc = {
      Data: dataObject,
      Signature: signature.trim()
    };

    const signedXml = builder.buildObject(finalDoc);
    logger.info('✅ Signed XML created successfully');
    
    return signedXml;
  }

  /**
   * Get certificate information for debugging
   */
  getCertificateInfo() {
    if (!this.certificate) return null;
    
    try {
      const pki = forge.pki;
      const cert = pki.certificateFromPem(this.certificate);
      
      return {
        subject: cert.subject.attributes,
        issuer: cert.issuer.attributes,
        validFrom: cert.validity.notBefore,
        validTo: cert.validity.notAfter,
        serialNumber: cert.serialNumber
      };
    } catch (error) {
      logger.error('Error reading certificate info:', error);
      return null;
    }
  }

  /**
   * Verify signature using ESS public key
   */
  verifySignature(data, signature) {
    if (!this.publicKey) {
      throw new Error('Public key not available for verification');
    }

    try {
      logger.info('🔍 Verifying signature...');
      
      // Create verify object with SHA256
      const verify = crypto.createVerify('SHA256');
      verify.update(data, 'utf8');
      verify.end();

      // Verify signature with ESS public key
      const isValid = verify.verify({
        key: this.publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, signature, 'base64');

      if (isValid) {
        logger.info('✅ Signature verification successful');
      } else {
        logger.error('❌ Signature verification failed');
      }

      return isValid;
    } catch (error) {
      logger.error('❌ Error verifying signature:', error);
      throw new Error('Failed to verify signature: ' + error.message);
    }
  }
}

// Create singleton instance
const digitalSignature = new DigitalSignature();

module.exports = digitalSignature;