const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

function generateCSR() {
  try {
    const keysDir = path.join(__dirname, 'keys');
    
    console.log('🔍 Checking for existing keys...');
    
    // Check if private key exists
    const privateKeyPath = path.join(keysDir, 'private.pem');
    if (!fs.existsSync(privateKeyPath)) {
      console.log('❌ Private key not found. Generating new keys first...');
      
      // Generate new keys using the same method as your keyGenerator
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
      fs.writeFileSync(privateKeyPath, privateKey);
      fs.writeFileSync(path.join(keysDir, 'public.pem'), publicKey);

      // Generate self-signed certificate for testing
      const pki = forge.pki;
      const forgeKeys = pki.rsa.generateKeyPair(2048);
      
      const cert = pki.createCertificate();
      cert.publicKey = forgeKeys.publicKey;
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
      
      cert.sign(forgeKeys.privateKey, forge.md.sha256.create());
      
      const certPem = pki.certificateToPem(cert);
      fs.writeFileSync(path.join(keysDir, 'certificate.crt'), certPem);

      console.log('✅ New keys and certificate generated:');
      console.log('   - private.pem');
      console.log('   - public.pem'); 
      console.log('   - certificate.crt');
    } else {
      console.log('✅ Private key found: keys/private.pem');
    }

    // Read the private key
    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
    
    // Convert to forge format for CSR generation
    console.log('📝 Generating Certificate Signing Request...');
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
    console.log('1. Send the file: keys/certificate_request.csr to ESS/CA');
    console.log('2. They will sign it and return: fspNameCertificate.crt');
    console.log('3. Place the received certificate in: keys/fspNameCertificate.crt');
    console.log('4. Update your .env file: CERTIFICATE_PATH=./keys/fspNameCertificate.crt');
    console.log('5. Restart your application');

  } catch (error) {
    console.error('❌ Error generating CSR:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run if called directly
if (require.main === module) {
  generateCSR();
}

module.exports = { generateCSR };