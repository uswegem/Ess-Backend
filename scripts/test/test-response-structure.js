const axios = require('axios');

const API_URL = 'http://135.181.33.13:3002/api/loan';

// Test various scenarios that should return RESPONSE message type
async function testResponseMessageStructure() {
    console.log('\n==================================================');
    console.log('TESTING RESPONSE MESSAGE TYPE STRUCTURE');
    console.log('All RESPONSE messages must have:');
    console.log('  <MessageDetails>');
    console.log('    <ResponseCode></ResponseCode>');
    console.log('    <Description></Description>');
    console.log('  </MessageDetails>');
    console.log('==================================================\n');

    const tests = [
        {
            name: 'TOP_UP_OFFER_REQUEST - ACK Response',
            xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TOPUP_${Date.now()}</MsgId>
            <MessageType>TOP_UP_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK123</CheckNumber>
            <LoanNumber>LOAN123</LoanNumber>
            <RequestedAmount>1000000.00</RequestedAmount>
        </MessageDetails>
    </Data>
</Document>`
        },
        {
            name: 'LOAN_TAKEOVER_OFFER_REQUEST - ACK Response',
            xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TAKEOVER_${Date.now()}</MsgId>
            <MessageType>LOAN_TAKEOVER_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK123</CheckNumber>
            <CurrentLoanBalance>5000000.00</CurrentLoanBalance>
            <RequestedAmount>6000000.00</RequestedAmount>
        </MessageDetails>
    </Data>
</Document>`
        },
        {
            name: 'TAKEOVER_PAY_OFF_BALANCE_REQUEST - ACK Response',
            xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>PAYOFF_${Date.now()}</MsgId>
            <MessageType>TAKEOVER_PAY_OFF_BALANCE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>CHK123</CheckNumber>
            <LoanNumber>LOAN123</LoanNumber>
        </MessageDetails>
    </Data>
</Document>`
        },
        {
            name: 'TAKEOVER_PAYMENT_NOTIFICATION - ACK Response',
            xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>PAYMENT_${Date.now()}</MsgId>
            <MessageType>TAKEOVER_PAYMENT_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <LoanNumber>LOAN123</LoanNumber>
            <PaymentAmount>5000000.00</PaymentAmount>
        </MessageDetails>
    </Data>
</Document>`
        },
        {
            name: 'LOAN_FINAL_APPROVAL_NOTIFICATION - ACK Response',
            xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>APPROVAL_${Date.now()}</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>APP123</ApplicationNumber>
            <LoanNumber>LOAN123</LoanNumber>
            <Approval>APPROVED</Approval>
        </MessageDetails>
    </Data>
</Document>`
        },
        {
            name: 'LOAN_CANCELLATION_NOTIFICATION - ACK Response (Non-existent Loan)',
            xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>CANCEL_${Date.now()}</MsgId>
            <MessageType>LOAN_CANCELLATION_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>NONEXISTENT${Date.now()}</ApplicationNumber>
            <LoanNumber>NONEXISTENT123</LoanNumber>
        </MessageDetails>
    </Data>
</Document>`
        }
    ];

    for (const test of tests) {
        await runTest(test);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait between tests
    }

    console.log('\n==================================================');
    console.log('ALL TESTS COMPLETED');
    console.log('==================================================');
}

async function runTest(test) {
    console.log(`\n=== TEST: ${test.name} ===`);
    
    try {
        const response = await axios.post(API_URL, test.xml, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 10000
        });

        console.log('Status:', response.status);
        
        // Extract key fields
        const messageTypeMatch = response.data.match(/<MessageType>([^<]+)<\/MessageType>/);
        const responseCodeMatch = response.data.match(/<ResponseCode>([^<]+)<\/ResponseCode>/);
        const descriptionMatch = response.data.match(/<Description>([^<]+)<\/Description>/);
        
        // Check for incorrect fields
        const statusMatch = response.data.match(/<Status>([^<]+)<\/Status>/);
        const statusCodeMatch = response.data.match(/<StatusCode>([^<]+)<\/StatusCode>/);
        const statusDescMatch = response.data.match(/<StatusDesc>([^<]+)<\/StatusDesc>/);
        const msgIdMatch = response.data.match(/<MsgId>([^<]+)<\/MsgId>/);
        const fspCodeMatch = response.data.match(/<FSPCode>([^<]+)<\/FSPCode>/);
        
        if (messageTypeMatch) {
            console.log('MessageType:', messageTypeMatch[1]);
            
            if (messageTypeMatch[1] === 'RESPONSE') {
                // Verify correct structure
                let isValid = true;
                
                if (!msgIdMatch) {
                    console.log('❌ ERROR: Missing <MsgId> in Header');
                    isValid = false;
                } else {
                    console.log('✅ Has MsgId:', msgIdMatch[1]);
                }
                
                if (!fspCodeMatch) {
                    console.log('❌ ERROR: Missing <FSPCode> in Header');
                    isValid = false;
                } else {
                    console.log('✅ Has FSPCode:', fspCodeMatch[1]);
                }
                
                if (!responseCodeMatch) {
                    console.log('❌ ERROR: Missing <ResponseCode> in MessageDetails');
                    isValid = false;
                } else {
                    console.log('✅ Has ResponseCode:', responseCodeMatch[1]);
                }
                
                if (!descriptionMatch) {
                    console.log('❌ ERROR: Missing <Description> in MessageDetails');
                    isValid = false;
                } else {
                    console.log('✅ Has Description:', descriptionMatch[1]);
                }
                
                // Check for incorrect fields
                if (statusMatch) {
                    console.log('❌ ERROR: Found incorrect field <Status> (should be removed)');
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
                    console.log('✅ PASS: RESPONSE message structure is CORRECT');
                } else {
                    console.log('❌ FAIL: RESPONSE message structure has ERRORS');
                    console.log('\nFull Response (first 500 chars):');
                    console.log(response.data.substring(0, 500));
                }
            }
        } else {
            console.log('❌ Could not extract MessageType');
        }
        
    } catch (error) {
        if (error.response) {
            console.error('HTTP Error:', error.response.status);
            console.log('Response:', error.response.data.substring(0, 500));
        } else if (error.code === 'ECONNABORTED') {
            console.error('❌ Timeout: Request took too long');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

// Run all tests
testResponseMessageStructure();
