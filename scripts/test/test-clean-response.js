const axios = require('axios');

const API_URL = 'http://135.181.33.13:3002/api/loan';

async function testCleanResponseStructure() {
    console.log('\n==================================================');
    console.log('TESTING: RESPONSE messages should NOT contain');
    console.log('  - OriginalMsgId');
    console.log('  - OriginalMessageType');
    console.log('  - LoanNumber (unless it\'s the main data)');
    console.log('==================================================\n');

    // Test 1: LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST with invalid data
    console.log('=== TEST 1: Invalid LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST ===');
    const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>RESTRUCTURE_AFF_${Date.now()}</MsgId>
            <MessageType>LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>INVALID</CheckNumber>
            <RequestedAmount>INVALID_AMOUNT</RequestedAmount>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post(API_URL, invalidXml, {
            headers: { 'Content-Type': 'application/xml' }
        });

        console.log('Status:', response.status);
        analyzeResponse(response.data);
    } catch (error) {
        if (error.response) {
            console.log('Status:', error.response.status);
            analyzeResponse(error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Non-existent loan lookup
    console.log('\n=== TEST 2: TOP_UP_PAY_0FF_BALANCE_REQUEST with non-existent loan ===');
    const nonExistentXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TOPUP_${Date.now()}</MsgId>
            <MessageType>TOP_UP_PAY_0FF_BALANCE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK123</CheckNumber>
            <LoanNumber>NONEXISTENT_LOAN_999</LoanNumber>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post(API_URL, nonExistentXml, {
            headers: { 'Content-Type': 'application/xml' }
        });

        console.log('Status:', response.status);
        analyzeResponse(response.data);
    } catch (error) {
        if (error.response) {
            console.log('Status:', error.response.status);
            analyzeResponse(error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }

    console.log('\n==================================================');
    console.log('TESTS COMPLETED');
    console.log('==================================================');
}

function analyzeResponse(data) {
    const messageTypeMatch = data.match(/<MessageType>([^<]+)<\/MessageType>/);
    const responseCodeMatch = data.match(/<ResponseCode>([^<]+)<\/ResponseCode>/);
    const descriptionMatch = data.match(/<Description>([^<]+)<\/Description>/);
    
    // Check for fields that should NOT be there
    const originalMsgIdMatch = data.match(/<OriginalMsgId>([^<]+)<\/OriginalMsgId>/);
    const originalMessageTypeMatch = data.match(/<OriginalMessageType>([^<]+)<\/OriginalMessageType>/);
    const loanNumberMatch = data.match(/<LoanNumber>([^<]+)<\/LoanNumber>/);
    
    console.log('\n📋 Response Analysis:');
    
    if (messageTypeMatch) {
        console.log('MessageType:', messageTypeMatch[1]);
        
        if (messageTypeMatch[1] === 'RESPONSE') {
            let isValid = true;
            
            if (responseCodeMatch) {
                console.log('✅ ResponseCode:', responseCodeMatch[1]);
            } else {
                console.log('❌ ERROR: Missing ResponseCode');
                isValid = false;
            }
            
            if (descriptionMatch) {
                const desc = descriptionMatch[1].substring(0, 80);
                console.log('✅ Description:', desc + (descriptionMatch[1].length > 80 ? '...' : ''));
            } else {
                console.log('❌ ERROR: Missing Description');
                isValid = false;
            }
            
            // Check for fields that should NOT exist
            if (originalMsgIdMatch) {
                console.log('❌ ERROR: Found OriginalMsgId:', originalMsgIdMatch[1], '(SHOULD NOT BE THERE)');
                isValid = false;
            } else {
                console.log('✅ CORRECT: No OriginalMsgId field');
            }
            
            if (originalMessageTypeMatch) {
                console.log('❌ ERROR: Found OriginalMessageType:', originalMessageTypeMatch[1], '(SHOULD NOT BE THERE)');
                isValid = false;
            } else {
                console.log('✅ CORRECT: No OriginalMessageType field');
            }
            
            if (loanNumberMatch) {
                console.log('⚠️  WARNING: Found LoanNumber:', loanNumberMatch[1], '(might be extra)');
            }
            
            if (isValid) {
                console.log('\n✅ PASS: Clean RESPONSE structure');
            } else {
                console.log('\n❌ FAIL: RESPONSE has incorrect fields');
            }
            
            // Show MessageDetails only
            const messageDetailsMatch = data.match(/<MessageDetails>([\s\S]*?)<\/MessageDetails>/);
            if (messageDetailsMatch) {
                console.log('\n📦 MessageDetails Content:');
                console.log(messageDetailsMatch[0]);
            }
        }
    }
}

testCleanResponseStructure();
