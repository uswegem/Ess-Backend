const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

function generateCSRFromExistingKeys() {
  try {
    const keysDir = path.join(__dirname, '../../keys');
    
    // Read your existing private key
    const privateKeyPath = path.join(keysDir, 'private.pem');
    if (!fs.existsSync(privateKeyPath)) {
      console.log('❌ Private key not found. Run generateKeys.js first.');
      return;
    }

    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
    
    // Convert to forge format for CSR generation
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

    // Create Certificate Signing Request
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = privateKey.publicKey;

    // Set CSR subject (customize for your FSP)
    csr.setSubject([
      {
        name: 'commonName',
        value: process.env.FSP_NAME || 'FSPSystem'  // Your FSP identifier
      },
      {
        name: 'organizationName', 
        value: process.env.ORG_NAME || 'Miracore Backend'
      },
      {
        name: 'organizationalUnitName',
        value: process.env.ORG_UNIT || 'e-MKOPO Integration'
      },
      {
        name: 'countryName',
        value: process.env.COUNTRY || 'TZ'
      },
      {
        name: 'stateOrProvinceName',
        value: process.env.STATE || 'Dar es Salaam'
      },
      {
        name: 'localityName',
        value: process.env.CITY || 'Dar es Salaam'
      },
      {
        name: 'emailAddress',
        value: process.env.EMAIL || 'admin@miracore.com'
      }
    ]);

    // Sign the CSR with your private key
    csr.sign(privateKey);

    // Convert to PEM format
    const csrPem = forge.pki.certificationRequestToPem(csr);

    // Save CSR
    const csrPath = path.join(keysDir, 'certificate_request.csr');
    fs.writeFileSync(csrPath, csrPem);

    console.log('✅ Certificate Signing Request generated successfully!');
    console.log('📄 File: keys/certificate_request.csr');
    
    console.log('\n📋 CSR Information:');
    const csrInfo = forge.pki.certificationRequestFromPem(csrPem);
    console.log('   Subject:', csrInfo.subject.attributes.map(attr => 
      `${attr.shortName || attr.name}=${attr.value}`
    ).join(', '));
    
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Send keys/certificate_request.csr to ESS/CA');
    console.log('2. They will return: fspNameCertificate.crt');
    console.log('3. Place it in keys/fspNameCertificate.crt');
    console.log('4. Update your .env file: CERTIFICATE_PATH=./keys/fspNameCertificate.crt');

  } catch (error) {
    console.error('❌ Error generating CSR:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  generateCSRFromExistingKeys();
}

module.exports = { generateCSRFromExistingKeys };