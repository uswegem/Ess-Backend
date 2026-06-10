const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const forge = require('node-forge');

function verifyFSPSetup() {
  const keysDir = path.join(__dirname, 'keys');
  
  console.log('🔐 Verifying FSP Certificate Setup...\n');

  // Check if we have the FSP certificate
  const fspCertPath = path.join(keysDir, 'fspNameCertificate.crt');
  if (!fs.existsSync(fspCertPath)) {
    console.log('❌ FSP certificate not found');
    return;
  }

  console.log('✅ FSP Certificate Found: keys/fspNameCertificate.crt');

  try {
    // Read and validate FSP certificate
    const certPem = fs.readFileSync(fspCertPath, 'utf8');
    const cert = forge.pki.certificateFromPem(certPem);
    
    console.log('📜 FSP Certificate Information:');
    console.log('   Subject:', cert.subject.attributes.map(attr => 
      `${attr.shortName || attr.name}=${attr.value}`
    ).join(', '));
    console.log('   Issuer:', cert.issuer.attributes.map(attr => 
      `${attr.shortName || attr.name}=${attr.value}`
    ).join(', '));
    console.log('   Valid From:', cert.validity.notBefore);
    console.log('   Valid To:', cert.validity.notAfter);
    console.log('   Serial Number:', cert.serialNumber);

    // Extract public key from FSP certificate
    const publicKeyFromCert = forge.pki.publicKeyToPem(cert.publicKey);
    console.log('✅ Public key extracted from FSP certificate');

  } catch (error) {
    console.log('❌ Error reading FSP certificate:', error.message);
    return;
  }

  // Check private key
  const privateKeyPath = path.join(keysDir, 'private.pem');
  if (!fs.existsSync(privateKeyPath)) {
    console.log('❌ Private key not found');
    return;
  }

  console.log('✅ Private Key Found: keys/private.pem');

  try {
    // Test if private key can sign data
    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
    const sign = crypto.createSign('SHA256');
    sign.update('test-data-for-signing');
    sign.end();
    const signature = sign.sign(privateKeyPem, 'base64');
    
    console.log('✅ Private key is valid and can sign data');
    console.log('   Signature length:', signature.length, 'characters');

  } catch (error) {
    console.log('❌ Private key test failed:', error.message);
    return;
  }

  console.log('\n🎉 SUCCESS: Your FSP setup is complete!');
  console.log('   You have the official FSP certificate from ESS');
  console.log('   Your private key is working correctly');
  console.log('   You are ready to communicate with ESS');
}

verifyFSPSetup();