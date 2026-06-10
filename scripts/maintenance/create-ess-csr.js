const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

try {
  console.log('🔐 Generating new FSP certificate request for ESS...');

  // Create directory if it doesn't exist
  const keysDir = path.join(__dirname, 'keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
  }

  // Generate a new key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);
  console.log('✅ Generated 2048-bit RSA key pair');

  // Save private key
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  fs.writeFileSync(path.join(keysDir, 'private.pem'), privateKeyPem);
  console.log('✅ Private key saved: keys/private.pem');

  // Create CSR
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;

  // Set certificate attributes as per ESS requirements
  csr.setSubject([
    { name: 'commonName', value: 'ZE DONE' },
    { name: 'organizationName', value: 'ZE DONE Ltd' },
    { name: 'organizationalUnitName', value: 'e-MKOPO Integration' },
    { name: 'countryName', value: 'TZ' },
    { name: 'stateOrProvinceName', value: 'Dar es Salaam' },
    { name: 'localityName', value: 'Dar es Salaam' }
  ]);

  // Sign CSR with private key
  csr.sign(keys.privateKey, forge.md.sha256.create());
  console.log('✅ CSR signed with SHA256');

  // Save CSR
  const csrPem = forge.pki.certificationRequestToPem(csr);
  fs.writeFileSync(path.join(keysDir, 'certificate_request.csr'), csrPem);

  console.log('✅ CSR generated: keys/certificate_request.csr');
  console.log('\n📋 Send this CSR file to ESS to get your official fspNameCertificate.crt');
  console.log('\nImportant: After receiving fspNameCertificate.crt from ESS:');
  console.log('1. Place it in the keys/ directory');
  console.log('2. Update your FSP_CODE in .env to match your assigned code');
  console.log('3. Test the connection using verify-fsp-setup.js');

} catch (error) {
  console.log('❌ Error:', error.message);
}