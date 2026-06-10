const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

async function verifyProductionCertKeyMatch() {
    console.log('��� Verifying Certificate-Private Key Match on Production Server\n');
    
    try {
        // Check production server certificate and private key
        console.log('��� PRODUCTION SERVER VERIFICATION');
        console.log('=' .repeat(50));
        
        console.log('\n1️⃣ Extracting certificate public key modulus...');
        const certCommand = 'ssh miracore "openssl x509 -in /home/uswege/ess/keys/certificate.crt -noout -modulus | openssl md5"';
        
        console.log('\n2️⃣ Extracting private key modulus...');  
        const keyCommand = 'ssh miracore "openssl rsa -in /home/uswege/ess/keys/private.pem -noout -modulus | openssl md5"';
        
        console.log('\n��� Commands to run on your terminal:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('# Certificate modulus hash:');
        console.log(certCommand);
        console.log('\n# Private key modulus hash:');
        console.log(keyCommand);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('\n��� VERIFICATION STEPS:');
        console.log('1. Run both commands above in your terminal');
        console.log('2. Compare the MD5 hash outputs');
        console.log('3. If hashes MATCH → Certificate and private key are a valid pair ✅');
        console.log('4. If hashes DIFFER → Mismatch - need to update certificates ❌');
        
        // Also check local backup for comparison
        console.log('\n��� LOCAL BACKUP COMPARISON:');
        console.log('=' .repeat(30));
        
        if (fs.existsSync('./keys/private.pem.backup')) {
            console.log('\n��� Local backup private key modulus:');
            const localKeyModulus = execSync('openssl rsa -in ./keys/private.pem.backup -noout -modulus | openssl md5', { encoding: 'utf8' }).trim();
            console.log('Local backup key:', localKeyModulus);
            
            console.log('\n��� Current local certificate modulus:');
            if (fs.existsSync('./keys/certificate.crt')) {
                const localCertModulus = execSync('openssl x509 -in ./keys/certificate.crt -noout -modulus | openssl md5', { encoding: 'utf8' }).trim();
                console.log('Local certificate:', localCertModulus);
                
                if (localKeyModulus === localCertModulus) {
                    console.log('\n✅ LOCAL: Certificate and backup private key MATCH');
                    console.log('��� This backup key should work with the certificate');
                } else {
                    console.log('\n❌ LOCAL: Certificate and backup private key DO NOT MATCH');
                }
            } else {
                console.log('❌ Local certificate.crt not found');
            }
        } else {
            console.log('❌ No local private key backup found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verifyProductionCertKeyMatch();
