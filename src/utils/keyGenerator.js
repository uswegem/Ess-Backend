const logger = require('./logger');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

function generateKeys() {
  try {
    const keysDir = path.join(__dirname, '../../keys');
    
    // Create keys directory if it doesn't exist
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    // Generate RSA key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Save keys
    fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKey);
    fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

    // Generate self-signed certificate for testing
    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(2048);
    
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    
    const attrs = [
      { name: 'commonName', value: 'Miracore Backend' },
      { name: 'organizationName', value: 'Tanzania Government' },
      { name: 'organizationalUnitName', value: 'Public Service Management' }
    ];
    
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true }
    ]);
    
    cert.sign(keys.privateKey, forge.md.sha256.create());
    
    const certPem = pki.certificateToPem(cert);
    fs.writeFileSync(path.join(keysDir, 'certificate.crt'), certPem);

    logger.info('✅ Keys and certificate generated successfully:');
    logger.info('   - private.pem');
    logger.info('   - public.pem'); 
    logger.info('   - certificate.crt');
    logger.info('\n Update your .env file with the key paths:');
    logger.info('   PRIVATE_KEY_PATH=./keys/private.pem');
    logger.info('   CERTIFICATE_PATH=./keys/certificate.crt');

  } catch (error) {
    logger.error('Error generating keys:', error);
  }
}

// Run if called directly
if (require.main === module) {
  generateKeys();
}

module.exports = { generateKeys };