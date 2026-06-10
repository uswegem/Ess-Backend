const axios = require('axios');

const API_URL = 'http://135.181.33.13:3002/api/loan';

// Test 1: Valid request - should return LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE
async function testValidRequest() {
    console.log('\n=== TEST 1: VALID REQUEST (should return LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE) ===');
    
    const validXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>RESTRUCTURE_TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <DesignationCode>TZ800186</DesignationCode>
            <DesignationName>ICTO II</DesignationName>
            <BasicSalary>2500000.00</BasicSalary>
            <NetSalary>1800000.00</NetSalary>
            <OneThirdAmount>600000.00</OneThirdAmount>
            <RequestedAmount>5000000.00</RequestedAmount>
            <DeductibleAmount>300000.00</DeductibleAmount>
            <DesiredDeductibleAmount>500000.00</DesiredDeductibleAmount>
            <RetirementDate>2030-12-31</RetirementDate>
            <TermsOfEmployment>Permanent and Pensionable</TermsOfEmployment>
            <Tenure>36</Tenure>
            <ProductCode>PROD001</ProductCode>
            <VoteCode>VC001</VoteCode>
            <TotalEmployeeDeduction>200000.00</TotalEmployeeDeduction>
            <JobClassCode>JB0012</JobClassCode>
            <LoanNumber>LOAN${Date.now()}</LoanNumber>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post(API_URL, validXml, {
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('Status:', response.status);
        console.log('Response Length:', response.data.length);
        
        // Extract MessageType
        const messageTypeMatch = response.data.match(/<MessageType>([^<]+)<\/MessageType>/);
        const responseCodeMatch = response.data.match(/<ResponseCode>([^<]+)<\/ResponseCode>/);
        
        if (messageTypeMatch) {
            console.log('✅ MessageType:', messageTypeMatch[1]);
            if (messageTypeMatch[1] === 'LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE') {
                console.log('✅ CORRECT: Success returns LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE');
            } else {
                console.log('❌ WRONG: Expected LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE');
            }
        }
        
        if (responseCodeMatch) {
            console.log('ResponseCode:', responseCodeMatch[1]);
        }
        
        // Check for success fields
        const eligibleAmountMatch = response.data.match(/<EligibleAmount>([^<]+)<\/EligibleAmount>/);
        const monthlyReturnMatch = response.data.match(/<MonthlyReturnAmount>([^<]+)<\/MonthlyReturnAmount>/);
        
        if (eligibleAmountMatch) {
            console.log('EligibleAmount:', eligibleAmountMatch[1]);
        }
        if (monthlyReturnMatch) {
            console.log('MonthlyReturnAmount:', monthlyReturnMatch[1]);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.status, error.response?.statusText);
        console.log('Response:', error.response?.data?.substring(0, 500));
    }
}

// Test 2: Invalid request - should return RESPONSE with error code
async function testInvalidRequest() {
    console.log('\n=== TEST 2: INVALID REQUEST (should return RESPONSE with ResponseCode) ===');
    
    // Missing required fields to trigger error
    const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>RESTRUCTURE_ERROR_${Date.now()}</MsgId>
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
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('Status:', response.status);
        console.log('Response Length:', response.data.length);
        
        // Extract MessageType
        const messageTypeMatch = response.data.match(/<MessageType>([^<]+)<\/MessageType>/);
        const responseCodeMatch = response.data.match(/<ResponseCode>([^<]+)<\/ResponseCode>/);
        const descriptionMatch = response.data.match(/<Description>([^<]+)<\/Description>/);
        
        if (messageTypeMatch) {
            console.log('✅ MessageType:', messageTypeMatch[1]);
            if (messageTypeMatch[1] === 'RESPONSE') {
                console.log('✅ CORRECT: Error returns RESPONSE message type');
            } else {
                console.log('❌ WRONG: Expected RESPONSE for error case');
            }
        }
        
        if (responseCodeMatch) {
            console.log('✅ ResponseCode:', responseCodeMatch[1]);
        }
        
        if (descriptionMatch) {
            console.log('✅ Description:', descriptionMatch[1]);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.status, error.response?.statusText);
        console.log('Response:', error.response?.data?.substring(0, 500));
    }
}

// Test 3: Malformed XML - should return RESPONSE with error code 8001
async function testMalformedXml() {
    console.log('\n=== TEST 3: MALFORMED XML (should return RESPONSE with ResponseCode 8001) ===');
    
    const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>MALFORMED_${Date.now()}</MsgId>
            <MessageType>LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK123</CheckNumber>
            <BasicSalary>5000.00< BasicSalary>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        const response = await axios.post(API_URL, malformedXml, {
            headers: {
                'Content-Type': 'application/xml'
            }
        });

        console.log('Status:', response.status);
        
        // Extract MessageType
        const messageTypeMatch = response.data.match(/<MessageType>([^<]+)<\/MessageType>/);
        const responseCodeMatch = response.data.match(/<ResponseCode>([^<]+)<\/ResponseCode>/);
        const descriptionMatch = response.data.match(/<Description>([^<]+)<\/Description>/);
        
        if (messageTypeMatch) {
            console.log('✅ MessageType:', messageTypeMatch[1]);
            if (messageTypeMatch[1] === 'RESPONSE') {
                console.log('✅ CORRECT: Malformed XML returns RESPONSE message type');
            }
        }
        
        if (responseCodeMatch) {
            console.log('✅ ResponseCode:', responseCodeMatch[1]);
            if (responseCodeMatch[1] === '8001') {
                console.log('✅ CORRECT: XML error returns code 8001');
            }
        }
        
        if (descriptionMatch) {
            console.log('✅ Description:', descriptionMatch[1].substring(0, 100));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.status, error.response?.statusText);
    }
}

// Run all tests
async function runAllTests() {
    console.log('==================================================');
    console.log('TESTING LOAN_RESTRUCTURE_AFFORDABILITY MESSAGE TYPES');
    console.log('==================================================');
    
    await testValidRequest();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between tests
    
    await testInvalidRequest();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testMalformedXml();
    
    console.log('\n==================================================');
    console.log('ALL TESTS COMPLETED');
    console.log('==================================================');
}

runAllTests();
