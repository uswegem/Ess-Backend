const axios = require('axios');

async function testServerConnection() {
    try {
        console.log('Testing server connection...');
        const response = await axios.get('http://135.181.33.13:3002/api');
        console.log('Server response:', response.data);
    } catch (error) {
        console.error('Connection error:', error.message);
    }
}

testServerConnection();