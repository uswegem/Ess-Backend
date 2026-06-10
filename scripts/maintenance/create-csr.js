const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

console.log('🚀 Creating CSR from existing keys...');

const keysDir = path.join(__dirname, 'keys');
const privateKeyPath = path.join(keysDir, 'private.pem');

// Check if private key exists
if (!fs.existsSync(privateKeyPath)) {
  console.log('❌ private.pem not found in keys folder');
  console.log('💡 Run: npm run generate-keys');
  process.exit(1);
}

try {
  // Read private key
  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

  // Create CSR
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = privateKey.publicKey;

  // Set subject
  csr.setSubject([
    { name: 'commonName', value: 'FSPSystem' },
    { name: 'organizationName', value: 'Miracore Backend' },
    { name: 'organizationalUnitName', value: 'e-MKOPO Integration' },
    { name: 'countryName', value: 'TZ' },
    { name: 'stateOrProvinceName', value: 'Dar es Salaam' },
    { name: 'localityName', value: 'Dar es Salaam' }
  ]);

  // Sign CSR
  csr.sign(privateKey);

  // Save CSR
  const csrPem = forge.pki.certificationRequestToPem(csr);
  fs.writeFileSync(path.join(keysDir, 'certificate_request.csr'), csrPem);

  console.log('✅ CSR generated: keys/certificate_request.csr');
  console.log('\n📋 Send this file to ESS to get fspNameCertificate.crt');

} catch (error) {
  console.log('❌ Error:', error.message);
}