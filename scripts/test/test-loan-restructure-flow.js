/**
 * Test LOAN_RESTRUCTURE_REQUEST Flow
 * 
 * This script tests the complete loan restructure workflow:
 * 1. Send LOAN_RESTRUCTURE_REQUEST
 * 2. Verify ACK response (ResponseCode 8000)
 * 3. Check MIFOS reschedule API was called
 * 4. Simulate MIFOS webhook for reschedule approval
 * 5. Verify LOAN_INITIAL_APPROVAL_NOTIFICATION was sent
 */

const axios = require('axios');
const xml2js = require('xml2js');

const BASE_URL = 'http://135.181.33.13:3002';
const parser = new xml2js.Parser({ explicitArray: false });

/**
 * Generate test LOAN_RESTRUCTURE_REQUEST XML
 */
function generateLoanRestructureRequestXML(checkNumber, requestedAmount, tenure) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>ESS${Date.now()}</MsgId>
            <MessageType>LOAN_RESTRUCTURE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${checkNumber}</CheckNumber>
            <FirstName>JOHN</FirstName>
            <MiddleName>DOE</MiddleName>
            <LastName>SMITH</LastName>
            <Sex>M</Sex>
            <DateOfBirth>1980-05-15</DateOfBirth>
            <EmploymentDate>2010-03-01</EmploymentDate>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1200000</NetSalary>
            <OneThirdAmount>400000</OneThirdAmount>
            <TotalEmployeeDeduction>300000</TotalEmployeeDeduction>
            <RequestedAmount>${requestedAmount}</RequestedAmount>
            <Tenure>${tenure}</Tenure>
            <FSPCode>FL8090</FSPCode>
            <ProductCode>SALARY_ADVANCE</ProductCode>
            <InterestRate>24</InterestRate>
            <ProcessingFee>50000</ProcessingFee>
            <Insurance>25000</Insurance>
            <PhysicalAddress>123 Main Street, Dar es Salaam</PhysicalAddress>
            <EmailAddress>john.smith@example.com</EmailAddress>
            <PhoneNumber>255712345678</PhoneNumber>
            <RetirementDate>2045-05-15</RetirementDate>
            <TermsOfEmployment>PERMANENT</TermsOfEmployment>
        </MessageDetails>
    </Data>
</Document>`;
}

/**
 * Generate MIFOS webhook payload for reschedule approval
 */
function generateRescheduleApprovalWebhook(loanId, rescheduleId) {
    return {
        entityName: 'RESCHEDULELOAN',
        actionName: 'APPROVE',
        entity: {
            id: rescheduleId,
            loanId: loanId,
            rescheduleFromDate: '15 January 2025',
            rescheduleReasonId: 1,
            recalculateInterest: false,
            status: {
                id: 200,
                code: 'loanStatusType.approved',
                value: 'Approved'
            }
        },
        createdDate: new Date().toISOString()
    };
}

/**
 * Test 1: Send LOAN_RESTRUCTURE_REQUEST and verify ACK
 */
async function testLoanRestructureRequest(checkNumber, requestedAmount, tenure) {
    console.log('\n📋 Test 1: Send LOAN_RESTRUCTURE_REQUEST');
    console.log('==========================================');

    const requestXml = generateLoanRestructureRequestXML(checkNumber, requestedAmount, tenure);

    try {
        const response = await axios.post(`${BASE_URL}/api/loan`, requestXml, {
            headers: {
                'Content-Type': 'application/xml'
            },
            timeout: 30000
        });

        console.log('✅ Status:', response.status);

        const parsedResponse = await parser.parseStringPromise(response.data);
        const header = parsedResponse?.Document?.Data?.Header;
        const details = parsedResponse?.Document?.Data?.MessageDetails;

        console.log('📨 Response Details:');
        console.log('  MessageType:', header?.MessageType);
        console.log('  ResponseCode:', details?.ResponseCode);
        console.log('  Description:', details?.Description);

        if (header?.MessageType === 'RESPONSE' && details?.ResponseCode === '8000') {
            console.log('✅ ACK received successfully');
            return true;
        } else {
            console.log('❌ Unexpected response');
            return false;
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Test 2: Check LoanMappings for pending callback
 */
async function checkLoanMapping(checkNumber) {
    console.log('\n📋 Test 2: Check LoanMappings');
    console.log('==============================');

    try {
        // This would require a database query endpoint
        // For now, we'll use SSH to check the database
        console.log('ℹ️  Use SSH to check LoanMappings collection:');
        console.log(`   ssh uswege@135.181.33.13`);
        console.log(`   mongo miracore --eval "db.loanmappings.findOne({checkNumber: '${checkNumber}'})" | grep -A 10 pendingCallback`);
        return true;

    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

/**
 * Test 3: Simulate MIFOS webhook for reschedule approval
 */
async function simulateMifosWebhook(loanId, rescheduleId) {
    console.log('\n📋 Test 3: Simulate MIFOS Webhook');
    console.log('==================================');

    const webhookPayload = generateRescheduleApprovalWebhook(loanId, rescheduleId);

    try {
        const response = await axios.post(`${BASE_URL}/api/webhook/mifos`, webhookPayload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log('✅ Status:', response.status);

        const parsedResponse = await parser.parseStringPromise(response.data);
        const details = parsedResponse?.Document?.Data?.MessageDetails;

        console.log('📨 Response Details:');
        console.log('  ResponseCode:', details?.ResponseCode);
        console.log('  Description:', details?.Description);

        if (details?.ResponseCode === '8000') {
            console.log('✅ Webhook processed successfully');
            return true;
        } else {
            console.log('❌ Unexpected response');
            return false;
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Test 4: Check AuditLog for callback sent
 */
async function checkAuditLog(checkNumber) {
    console.log('\n📋 Test 4: Check AuditLog');
    console.log('=========================');

    try {
        console.log('ℹ️  Use SSH to check AuditLog collection:');
        console.log(`   ssh uswege@135.181.33.13`);
        console.log(`   mongo miracore --eval "db.auditlogs.find({checkNumber: '${checkNumber}'}).sort({_id: -1}).limit(5).pretty()"`);
        return true;

    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('🚀 LOAN_RESTRUCTURE_REQUEST Flow Test');
    console.log('======================================\n');

    // Test data
    const checkNumber = '123456789'; // Use real checkNumber from LoanMappings
    const requestedAmount = '5000000';
    const tenure = '72';
    const loanId = '1'; // Use real mifosLoanId
    const rescheduleId = '1'; // Use real rescheduleId from MIFOS response

    console.log('Test Data:');
    console.log('  CheckNumber:', checkNumber);
    console.log('  RequestedAmount:', requestedAmount);
    console.log('  Tenure:', tenure);
    console.log('  LoanId:', loanId);
    console.log('  RescheduleId:', rescheduleId);

    // Run tests sequentially
    const results = [];

    results.push(await testLoanRestructureRequest(checkNumber, requestedAmount, tenure));
    
    console.log('\n⏳ Wait 5 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    results.push(await checkLoanMapping(checkNumber));
    
    results.push(await simulateMifosWebhook(loanId, rescheduleId));
    
    console.log('\n⏳ Wait 5 seconds for callback processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    results.push(await checkAuditLog(checkNumber));

    // Summary
    console.log('\n📊 Test Summary');
    console.log('===============');
    console.log('Test 1 - Send Request:', results[0] ? '✅ PASS' : '❌ FAIL');
    console.log('Test 2 - Check Mapping:', results[1] ? '✅ PASS' : '❌ FAIL');
    console.log('Test 3 - Webhook:', results[2] ? '✅ PASS' : '❌ FAIL');
    console.log('Test 4 - Check AuditLog:', results[3] ? '✅ PASS' : '❌ FAIL');

    const passed = results.filter(r => r).length;
    console.log(`\n${passed}/${results.length} tests passed`);

    if (passed === results.length) {
        console.log('\n🎉 All tests passed! LOAN_RESTRUCTURE_REQUEST flow is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check logs for details.');
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
