const axios = require('axios');

const API_URL = 'http://135.181.33.13:3002/api/loan';

async function testErrorResponseStructures() {
    console.log('\n==================================================');
    console.log('TESTING ERROR RESPONSE MESSAGE STRUCTURES');
    console.log('All error RESPONSE messages must have:');
    console.log('  <MessageDetails>');
    console.log('    <ResponseCode></ResponseCode>');
    console.log('    <Description></Description>');
    console.log('  </MessageDetails>');
    console.log('==================================================\n');

    // Test 1: Malformed XML
    console.log('\n=== TEST 1: Malformed XML (should return RESPONSE with 8001) ===');
    const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <MsgId>TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        <MessageDetails>
            <CheckNumber>CHK123< CheckNumber>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post(API_URL, malformedXml, {
            headers: { 'Content-Type': 'application/xml' }
        });
        analyzeResponse(response.data, '8001');
    } catch (error) {
        if (error.response) {
            analyzeResponse(error.response.data, '8001');
        }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Test 2: Invalid calculation (LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST)
    console.log('\n=== TEST 2: Invalid Calculation Data (should return RESPONSE with 8005) ===');
    const invalidCalcXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>INVALID_${Date.now()}</MsgId>
            <MessageType>LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>INVALID</CheckNumber>
            <RequestedAmount>INVALID_AMOUNT</RequestedAmount>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post(API_URL, invalidCalcXml, {
            headers: { 'Content-Type': 'application/xml' }
        });
        analyzeResponse(response.data, '8005');
    } catch (error) {
        if (error.response) {
            analyzeResponse(error.response.data, '8005');
        }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Test 3: Missing required fields
    console.log('\n=== TEST 3: Missing Required Fields (should return RESPONSE with error code) ===');
    const missingFieldsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>MISSING_${Date.now()}</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <LoanNumber>LOAN123</LoanNumber>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post(API_URL, missingFieldsXml, {
            headers: { 'Content-Type': 'application/xml' }
        });
        analyzeResponse(response.data, '8003');
    } catch (error) {
        if (error.response) {
            analyzeResponse(error.response.data, '8003');
        }
    }

    console.log('\n==================================================');
    console.log('ERROR RESPONSE STRUCTURE TESTS COMPLETED');
    console.log('==================================================');
}

function analyzeResponse(data, expectedCode) {
    const messageTypeMatch = data.match(/<MessageType>([^<]+)<\/MessageType>/);
    const responseCodeMatch = data.match(/<ResponseCode>([^<]+)<\/ResponseCode>/);
    const descriptionMatch = data.match(/<Description>([^<]+)<\/Description>/);
    const msgIdMatch = data.match(/<MsgId>([^<]+)<\/MsgId>/);
    const fspCodeMatch = data.match(/<FSPCode>([^<]+)<\/FSPCode>/);
    
    // Check for incorrect fields
    const statusMatch = data.match(/<Status>([^<]+)<\/Status>/);
    const statusCodeMatch = data.match(/<StatusCode>([^<]+)<\/StatusCode>/);
    const statusDescMatch = data.match(/<StatusDesc>([^<]+)<\/StatusDesc>/);
    
    let isValid = true;
    
    if (messageTypeMatch) {
        console.log('MessageType:', messageTypeMatch[1]);
        if (messageTypeMatch[1] !== 'RESPONSE') {
            console.log('❌ ERROR: Expected MessageType=RESPONSE for error case');
            isValid = false;
        } else {
            console.log('✅ Correct: MessageType is RESPONSE');
        }
    } else {
        console.log('❌ ERROR: Missing MessageType');
        isValid = false;
    }
    
    if (!msgIdMatch) {
        console.log('❌ ERROR: Missing <MsgId>');
        isValid = false;
    } else {
        console.log('✅ Has MsgId:', msgIdMatch[1]);
    }
    
    if (!fspCodeMatch) {
        console.log('❌ ERROR: Missing <FSPCode>');
        isValid = false;
    } else {
        console.log('✅ Has FSPCode:', fspCodeMatch[1]);
    }
    
    if (!responseCodeMatch) {
        console.log('❌ ERROR: Missing <ResponseCode>');
        isValid = false;
    } else {
        console.log('✅ Has ResponseCode:', responseCodeMatch[1]);
        if (expectedCode && responseCodeMatch[1] !== expectedCode) {
            console.log(`   Note: Expected ${expectedCode}, got ${responseCodeMatch[1]}`);
        }
    }
    
    if (!descriptionMatch) {
        console.log('❌ ERROR: Missing <Description>');
        isValid = false;
    } else {
        const desc = descriptionMatch[1].substring(0, 100);
        console.log('✅ Has Description:', desc + (descriptionMatch[1].length > 100 ? '...' : ''));
    }
    
    // Check for incorrect fields
    if (statusMatch) {
        console.log('❌ ERROR: Found incorrect field <Status>');
        isValid = false;
    }
    
    if (statusCodeMatch) {
        console.log('❌ ERROR: Found incorrect field <StatusCode> (should be <ResponseCode>)');
        isValid = false;
    }
    
    if (statusDescMatch) {
        console.log('❌ ERROR: Found incorrect field <StatusDesc> (should be <Description>)');
        isValid = false;
    }
    
    if (isValid) {
        console.log('✅ PASS: Error response structure is CORRECT');
    } else {
        console.log('❌ FAIL: Error response structure has ERRORS');
        console.log('\nFull Response (first 800 chars):');
        console.log(data.substring(0, 800));
    }
}

testErrorResponseStructures();
