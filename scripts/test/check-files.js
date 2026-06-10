const fs = require('fs');
const path = require('path');

function checkFiles() {
  const keysDir = path.join(__dirname, 'keys');
  
  console.log('📁 Checking files in keys directory...\n');
  
  if (!fs.existsSync(keysDir)) {
    console.log('❌ keys directory does not exist');
    return;
  }

  const files = fs.readdirSync(keysDir);
  
  if (files.length === 0) {
    console.log('❌ keys directory is empty');
    return;
  }

  console.log('📋 Files found in keys directory:');
  files.forEach(file => {
    const filePath = path.join(keysDir, file);
    const stats = fs.statSync(filePath);
    console.log(`   📄 ${file} (${Math.round(stats.size / 1024)} KB)`);
  });

  // Check for specific important files
  const importantFiles = [
    'private.pem',
    'public.pem', 
    'certificate.crt',
    'certificate_request.csr',
    'fspNameCertificate.crt'
  ];

  console.log('\n🔍 Status of important files:');
  importantFiles.forEach(file => {
    const exists = fs.existsSync(path.join(keysDir, file));
    console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  });

  // Check if we can read private key
  console.log('\n🔐 Testing private key...');
  try {
    const privateKey = fs.readFileSync(path.join(keysDir, 'private.pem'), 'utf8');
    console.log('✅ Private key is readable');
    console.log('   First line:', privateKey.split('\n')[0]);
  } catch (error) {
    console.log('❌ Cannot read private key:', error.message);
  }
}

checkFiles();