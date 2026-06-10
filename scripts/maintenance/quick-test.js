const axios = require('axios');

console.log('Testing connection to remote server...\n');

axios({
    method: 'get',
    url: 'http://135.181.33.13:3002/api/loan',
    timeout: 5000
})
.then(response => {
    console.log('✅ Connection successful!');
    console.log('Status:', response.status);
})
.catch(error => {
    console.log('❌ Connection failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
        console.log('   Server is not accepting connections on port 3002');
    } else if (error.code === 'ETIMEDOUT') {
        console.log('   Connection timed out - server may be down or firewall blocking');
    }
    process.exit(1);
});
