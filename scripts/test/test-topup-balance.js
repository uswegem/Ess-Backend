const axios = require('axios');
require('dotenv').config();

const testTopUpBalanceRequest = async () => {
    try {
        console.log('🧪 Testing TOP_UP_PAY_0FF_BALANCE_REQUEST...');
        
        const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_TOPUP_${Date.now()}</MsgId>
            <MessageType>TOP_UP_PAY_0FF_BALANCE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>110977381</CheckNumber>
            <LoanNumber>LOAN1763993570520861</LoanNumber>
            <FirstName>MARRY</FirstName>
            <MiddleName>EDWARD</MiddleName>
            <LastName>NTIGA</LastName>
            <VoteCode>32</VoteCode>
            <VoteName>President's Office - Public Service Management and Good Governance</VoteName>
            <DeductionName>ZE DONE</DeductionName>
            <DeductionCode>FL8090</DeductionCode>
            <DeductionAmount>11000000.00</DeductionAmount>
            <DeductionBalance>10730818.90</DeductionBalance>
            <PaymentOption>Full Payment option</PaymentOption>
        </MessageDetails>
    </Data>
</Document>`;

        console.log('📤 Sending request to local server...');
        console.log('Request XML:', xmlPayload.substring(0, 200) + '...');

        const response = await axios.post('http://localhost:3002/api/loan', xmlPayload, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 10000
        });

        console.log('\n✅ Response Status:', response.status);
        console.log('📋 Response Headers:', response.headers['content-type']);
        console.log('📄 Response Body:');
        console.log(response.data);

        // Try to parse the XML response to check structure
        if (typeof response.data === 'string' && response.data.includes('<?xml')) {
            console.log('\n🔍 Response appears to be valid XML');
            
            // Check if it's a success response or error
            if (response.data.includes('LOAN_TOP_UP_BALANCE_RESPONSE')) {
                console.log('✅ Success: Received LOAN_TOP_UP_BALANCE_RESPONSE');
            } else if (response.data.includes('"MessageType":"RESPONSE"') && response.data.includes('ResponseCode')) {
                console.log('⚠️ Received error RESPONSE');
            } else {
                console.log('❓ Unknown response type');
            }
        }

    } catch (error) {
        console.error('\n❌ Error during test:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Response Data:', error.response?.data);
        console.error('Error Message:', error.message);
    }
};

testTopUpBalanceRequest();